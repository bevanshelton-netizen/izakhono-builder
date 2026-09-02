import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'

const port = Number(process.env.IZ_CORE_ACTION_TEST_PORT || 18790)
const base = `http://127.0.0.1:${port}`
const adminToken = 'ci-action-admin-token-0123456789-abcdefghijklmnopqrstuvwxyz'
const jwtSecret = 'ci-action-jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const project = `action-ci-${Date.now()}`
const projectKey = 'pk_action_ci_0123456789_abcdefghijklmnopqrstuvwxyz'

const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    IZAKHONO_CORE_ADMIN_TOKEN: adminToken,
    IZAKHONO_CORE_JWT_SECRET: jwtSecret,
    IZAKHONO_CORE_STORAGE_DIR: `/tmp/izakhono-action-${process.pid}`,
    IZAKHONO_CORE_ALLOWED_ORIGINS: 'https://example.test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr.on('data', chunk => { stderr += chunk })

async function jsonCall(path, { method = 'GET', token, key = projectKey, body } = {}) {
  const headers = {}
  if (key) headers['X-Project-Key'] = key
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let data
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { response, data }
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

async function signup(email) {
  const result = await jsonCall(`/v1/auth/${project}/signup`, {
    method: 'POST',
    body: { email, password: 'Trusted-Action-Strong-123!' },
  })
  assert.equal(result.response.status, 201, `signup failed for ${email}: ${JSON.stringify(result.data)}`)
  return result.data
}

async function setPolicy(table, readRoles, writeRoles) {
  const result = await jsonCall('/v2/admin/policies', {
    method: 'POST', key: null, token: adminToken,
    body: {
      project,
      table,
      mode: 'scope',
      scope_field: 'centre_id',
      read_roles: readRoles,
      write_roles: writeRoles,
    },
  })
  assert.equal(result.response.status, 200, `policy failed for ${table}: ${JSON.stringify(result.data)}`)
}

async function membership(email, scopeId, role) {
  const result = await jsonCall('/v2/admin/memberships', {
    method: 'POST', key: null, token: adminToken,
    body: { project, email, scope_id: scopeId, role },
  })
  assert.equal(result.response.status, 200, `membership failed for ${email}: ${JSON.stringify(result.data)}`)
}

async function action(token, body) {
  return jsonCall(`/v3/actions/${project}/atomic-scope-batch`, { method: 'POST', token, body })
}

async function rows(token, table, query = '') {
  const result = await jsonCall(`/v2/data/${project}/${table}${query}`, { token })
  assert.equal(result.response.status, 200, `read failed for ${table}: ${JSON.stringify(result.data)}`)
  return result.data
}

try {
  await waitHealthy()

  let result = await jsonCall('/v1/admin/projects', {
    method: 'POST', key: null, token: adminToken,
    body: { project, public_key: projectKey, allow_signup: true },
  })
  assert.equal(result.response.status, 201)

  const owner = await signup('owner@actions.example.test')
  const teacher = await signup('teacher@actions.example.test')
  const accountant = await signup('accountant@actions.example.test')

  await setPolicy('children', ['owner', 'teacher', 'accountant'], ['owner', 'teacher'])
  await setPolicy('guardians', ['owner', 'teacher'], ['owner', 'teacher'])
  await setPolicy('child_guardians', ['owner', 'teacher'], ['owner', 'teacher'])

  await membership('owner@actions.example.test', 'centre-a', 'owner')
  await membership('teacher@actions.example.test', 'centre-a', 'teacher')
  await membership('accountant@actions.example.test', 'centre-a', 'accountant')

  result = await jsonCall('/v3/actions/capabilities', { key: null })
  assert.equal(result.response.status, 200)
  assert.equal(result.data.capabilities.trustedScopedActions, true)
  assert.equal(result.data.capabilities.atomicScopeBatch, true)
  assert.equal(result.data.capabilities.delete, false)
  assert.equal(result.data.capabilities.arbitrarySql, false)

  result = await action(teacher.access_token, {
    scope_id: 'centre-a',
    operations: [
      { op: 'insert', table: 'children', id: 'child-1', data: { centre_id: 'centre-a', name: 'Amina Synthetic' } },
      { op: 'insert', table: 'guardians', id: 'guardian-1', data: { centre_id: 'centre-a', name: 'Thandi Synthetic' } },
      { op: 'insert', table: 'child_guardians', id: 'link-1', data: { centre_id: 'centre-a', child_id: 'child-1', guardian_id: 'guardian-1' } },
    ],
  })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.equal(result.data.results.length, 3)

  let visible = await rows(teacher.access_token, 'children', '?centre_id=centre-a')
  assert.deepEqual(visible.map(row => row.id), ['child-1'])

  result = await action(accountant.access_token, {
    scope_id: 'centre-a',
    operations: [
      { op: 'insert', table: 'children', id: 'child-denied', data: { centre_id: 'centre-a', name: 'Denied' } },
    ],
  })
  assert.equal(result.response.status, 403)
  visible = await rows(owner.access_token, 'children', '?centre_id=centre-a')
  assert.equal(visible.some(row => row.id === 'child-denied'), false)

  result = await action(teacher.access_token, {
    scope_id: 'centre-b',
    operations: [
      { op: 'insert', table: 'children', id: 'cross-centre-denied', data: { centre_id: 'centre-b', name: 'Denied cross centre' } },
    ],
  })
  assert.equal(result.response.status, 403)

  result = await action(teacher.access_token, {
    scope_id: 'centre-a',
    operations: [
      { op: 'insert', table: 'children', id: 'rollback-child', data: { centre_id: 'centre-a', name: 'Must roll back' } },
      { op: 'insert', table: 'guardians', id: 'guardian-1', data: { centre_id: 'centre-a', name: 'Duplicate conflict' } },
    ],
  })
  assert.equal(result.response.status, 409)
  visible = await rows(owner.access_token, 'children', '?centre_id=centre-a')
  assert.equal(visible.some(row => row.id === 'rollback-child'), false, 'first operation must roll back when a later operation fails')

  result = await action(owner.access_token, {
    scope_id: 'centre-a',
    operations: [
      { op: 'patch', table: 'children', id: 'child-1', data: { nickname: 'Amina' } },
      { op: 'patch', table: 'guardians', id: 'guardian-1', data: { relationship: 'guardian' } },
    ],
  })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  visible = await rows(owner.access_token, 'children', '?centre_id=centre-a')
  assert.equal(visible.find(row => row.id === 'child-1')?.nickname, 'Amina')

  result = await action(owner.access_token, {
    scope_id: 'centre-a',
    operations: [
      { op: 'delete', table: 'children', id: 'child-1', data: {} },
    ],
  })
  assert.equal(result.response.status, 400)

  console.log('PASS IZAKHONO Core trusted scoped actions E2E')
  console.log('  ✓ named action endpoint executes scoped inserts/patches atomically')
  console.log('  ✓ server-side role checks deny Accountant writes and cross-centre writes')
  console.log('  ✓ later-operation failure rolls the entire batch back')
  console.log('  ✓ delete and arbitrary SQL are not exposed by the trusted action surface')
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([once(child, 'exit'), sleep(5000)])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
}
