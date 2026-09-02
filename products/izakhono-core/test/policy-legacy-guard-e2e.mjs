import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'

const port = Number(process.env.IZ_CORE_POLICY_GUARD_TEST_PORT || 18789)
const base = `http://127.0.0.1:${port}`
const adminToken = 'ci-admin-token-0123456789-abcdefghijklmnopqrstuvwxyz'
const jwtSecret = 'ci-jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const project = `guard-ci-${Date.now()}`
const projectKey = 'pk_guard_ci_0123456789_abcdefghijklmnopqrstuvwxyz'

const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    IZAKHONO_CORE_ADMIN_TOKEN: adminToken,
    IZAKHONO_CORE_JWT_SECRET: jwtSecret,
    IZAKHONO_CORE_STORAGE_DIR: `/tmp/izakhono-policy-guard-${process.pid}`,
    IZAKHONO_CORE_ALLOWED_ORIGINS: 'https://example.test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr.on('data', chunk => { stderr += chunk })

async function call(path, { method = 'GET', token, key = projectKey, body } = {}) {
  const headers = {}
  if (key) headers['X-Project-Key'] = key
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { response, data: await response.json() }
}

async function waitHealthy() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`${base}/healthz`)
      if (response.ok) return
    } catch {}
    if (child.exitCode !== null) throw new Error(`Core exited early: ${child.exitCode}\n${stderr}`)
    await sleep(250)
  }
  throw new Error('Core health timeout')
}

try {
  await waitHealthy()

  let result = await call('/v1/admin/projects', {
    method: 'POST', key: null, token: adminToken,
    body: { project, public_key: projectKey, allow_signup: true },
  })
  assert.equal(result.response.status, 201)

  result = await call(`/v1/auth/${project}/signup`, {
    method: 'POST',
    body: { email: 'owner@guard.example.test', password: 'Owner-Strong-123!' },
  })
  assert.equal(result.response.status, 201)
  const owner = result.data

  result = await call('/v2/admin/policies', {
    method: 'POST', key: null, token: adminToken,
    body: {
      project,
      table: 'children',
      mode: 'scope',
      scope_field: 'centre_id',
      read_roles: ['owner'],
      write_roles: ['owner'],
    },
  })
  assert.equal(result.response.status, 200)

  result = await call('/v2/admin/memberships', {
    method: 'POST', key: null, token: adminToken,
    body: { project, email: 'owner@guard.example.test', scope_id: 'centre-a', role: 'owner' },
  })
  assert.equal(result.response.status, 200)

  const legacyInsert = await call(`/v1/data/${project}/children`, {
    method: 'POST', token: owner.access_token,
    body: { data: { id: 'legacy-leak', centre_id: 'centre-a', name: 'Must be blocked' } },
  })
  assert.equal(legacyInsert.response.status, 409)
  assert.equal(legacyInsert.data.code, 'IZAKHONO_SCOPE_POLICY_V2_REQUIRED')

  const policyInsert = await call(`/v2/data/${project}/children`, {
    method: 'POST', token: owner.access_token,
    body: { data: { id: 'safe-row', centre_id: 'centre-a', name: 'Policy protected' } },
  })
  assert.equal(policyInsert.response.status, 201)

  const legacyRead = await call(`/v1/data/${project}/children`, { token: owner.access_token })
  assert.equal(legacyRead.response.status, 409)
  assert.equal(legacyRead.data.code, 'IZAKHONO_SCOPE_POLICY_V2_REQUIRED')

  const policyRead = await call(`/v2/data/${project}/children`, { token: owner.access_token })
  assert.equal(policyRead.response.status, 200)
  assert.deepEqual(policyRead.data.map(row => row.id), ['safe-row'])

  console.log('PASS IZAKHONO Core legacy scope guard E2E')
  console.log('  ✓ scoped tables cannot fall through to permissive v1 project semantics')
  console.log('  ✓ /v2 policy route remains available for authorized scoped access')
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([once(child, 'exit'), sleep(5000)])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
}
