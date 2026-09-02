import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'

const port = Number(process.env.IZ_CORE_POLICY_TEST_PORT || 18788)
const base = `http://127.0.0.1:${port}`
const adminToken = 'ci-admin-token-0123456789-abcdefghijklmnopqrstuvwxyz'
const jwtSecret = 'ci-jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const project = `policy-ci-${Date.now()}`
const projectKey = 'pk_policy_ci_0123456789_abcdefghijklmnopqrstuvwxyz'

const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    IZAKHONO_CORE_ADMIN_TOKEN: adminToken,
    IZAKHONO_CORE_JWT_SECRET: jwtSecret,
    IZAKHONO_CORE_STORAGE_DIR: `/tmp/izakhono-policy-e2e-${process.pid}`,
    IZAKHONO_CORE_ALLOWED_ORIGINS: 'https://example.test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''
child.stdout.on('data', chunk => { stdout += chunk })
child.stderr.on('data', chunk => { stderr += chunk })

async function http(path, { method = 'GET', token, key = projectKey, body } = {}) {
  const headers = {}
  if (key) headers['X-Project-Key'] = key
  if (token) headers.Authorization = `Bearer ${token}`
  let requestBody
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }
  const response = await fetch(`${base}${path}`, { method, headers, body: requestBody })
  const data = await response.json()
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
  throw new Error(`Core health timeout\nstdout:\n${stdout}\nstderr:\n${stderr}`)
}

async function admin(path, body) {
  return http(path, { method: 'POST', key: null, token: adminToken, body })
}

async function signup(email, name) {
  const result = await http(`/v1/auth/${project}/signup`, {
    method: 'POST',
    body: { email, password: `Strong-${name}-123!`, user_metadata: { name } },
  })
  assert.equal(result.response.status, 201, JSON.stringify(result.data))
  return result.data
}

async function policy(table, readRoles, writeRoles) {
  const result = await admin('/v2/admin/policies', {
    project,
    table,
    mode: 'scope',
    scope_field: 'centre_id',
    read_roles: readRoles,
    write_roles: writeRoles,
  })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
}

async function membership(email, scopeId, role) {
  const result = await admin('/v2/admin/memberships', { project, email, scope_id: scopeId, role })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
}

try {
  await waitHealthy()

  const created = await admin('/v1/admin/projects', {
    project,
    public_key: projectKey,
    allow_signup: true,
  })
  assert.equal(created.response.status, 201, JSON.stringify(created.data))

  const owner = await signup('owner@policy.example.test', 'Owner')
  const principal = await signup('principal@policy.example.test', 'Principal')
  const teacher = await signup('teacher@policy.example.test', 'Teacher')
  const accountant = await signup('accountant@policy.example.test', 'Accountant')
  const parent = await signup('parent@policy.example.test', 'Parent')
  const otherOwner = await signup('other-owner@policy.example.test', 'OtherOwner')

  await policy('children', ['owner', 'principal', 'teacher'], ['owner', 'principal'])
  await policy('observations', ['owner', 'principal', 'teacher'], ['owner', 'principal', 'teacher'])
  await policy('invoices', ['owner', 'principal', 'accountant'], ['owner', 'principal', 'accountant'])

  await membership('owner@policy.example.test', 'centre-a', 'owner')
  await membership('principal@policy.example.test', 'centre-a', 'principal')
  await membership('teacher@policy.example.test', 'centre-a', 'teacher')
  await membership('accountant@policy.example.test', 'centre-a', 'accountant')
  await membership('other-owner@policy.example.test', 'centre-b', 'owner')

  let result = await http(`/v2/data/${project}/children`, {
    method: 'POST', token: owner.access_token,
    body: { data: { id: 'child-a', centre_id: 'centre-a', name: 'Amina Pilot' } },
  })
  assert.equal(result.response.status, 201, JSON.stringify(result.data))

  result = await http(`/v2/data/${project}/children`, {
    method: 'POST', token: otherOwner.access_token,
    body: { data: { id: 'child-b', centre_id: 'centre-b', name: 'Bongani Pilot' } },
  })
  assert.equal(result.response.status, 201, JSON.stringify(result.data))

  result = await http(`/v2/data/${project}/observations`, {
    method: 'POST', token: teacher.access_token,
    body: { data: { id: 'obs-a', centre_id: 'centre-a', child_id: 'child-a', note: 'Synthetic observation' } },
  })
  assert.equal(result.response.status, 201, JSON.stringify(result.data))

  result = await http(`/v2/data/${project}/invoices`, {
    method: 'POST', token: accountant.access_token,
    body: { data: { id: 'invoice-a', centre_id: 'centre-a', child_id: 'child-a', amount: '950.00' } },
  })
  assert.equal(result.response.status, 201, JSON.stringify(result.data))

  const grant = await admin('/v2/admin/row-grants', {
    project,
    table: 'children',
    row_id: 'child-a',
    email: 'parent@policy.example.test',
    can_read: true,
    can_write: false,
  })
  assert.equal(grant.response.status, 200, JSON.stringify(grant.data))

  const principalChildren = await http(`/v2/data/${project}/children`, { token: principal.access_token })
  assert.equal(principalChildren.response.status, 200)
  assert.deepEqual(principalChildren.data.map(row => row.id), ['child-a'])

  const teacherChildren = await http(`/v2/data/${project}/children`, { token: teacher.access_token })
  assert.deepEqual(teacherChildren.data.map(row => row.id), ['child-a'])

  const teacherInvoices = await http(`/v2/data/${project}/invoices`, { token: teacher.access_token })
  assert.deepEqual(teacherInvoices.data, [])

  const accountantChildren = await http(`/v2/data/${project}/children`, { token: accountant.access_token })
  assert.deepEqual(accountantChildren.data, [])
  const accountantObservations = await http(`/v2/data/${project}/observations`, { token: accountant.access_token })
  assert.deepEqual(accountantObservations.data, [])
  const accountantInvoices = await http(`/v2/data/${project}/invoices`, { token: accountant.access_token })
  assert.deepEqual(accountantInvoices.data.map(row => row.id), ['invoice-a'])

  const parentChildren = await http(`/v2/data/${project}/children`, { token: parent.access_token })
  assert.deepEqual(parentChildren.data.map(row => row.id), ['child-a'])

  const otherChildren = await http(`/v2/data/${project}/children`, { token: otherOwner.access_token })
  assert.deepEqual(otherChildren.data.map(row => row.id), ['child-b'])

  const teacherCannotEditChild = await http(`/v2/data/${project}/children/child-a`, {
    method: 'PATCH', token: teacher.access_token, body: { data: { name: 'Teacher edit denied' } },
  })
  assert.equal(teacherCannotEditChild.response.status, 404)

  const parentCannotEditChild = await http(`/v2/data/${project}/children/child-a`, {
    method: 'PATCH', token: parent.access_token, body: { data: { name: 'Parent edit denied' } },
  })
  assert.equal(parentCannotEditChild.response.status, 404)

  const principalCanEditChild = await http(`/v2/data/${project}/children/child-a`, {
    method: 'PATCH', token: principal.access_token, body: { data: { name: 'Amina Pilot Updated' } },
  })
  assert.equal(principalCanEditChild.response.status, 200)
  assert.equal(principalCanEditChild.data.name, 'Amina Pilot Updated')

  const crossScopeCreate = await http(`/v2/data/${project}/children`, {
    method: 'POST', token: owner.access_token,
    body: { data: { id: 'forbidden-child', centre_id: 'centre-b', name: 'Must not insert' } },
  })
  assert.equal(crossScopeCreate.response.status, 403)

  const capabilities = await http('/v2/capabilities', { key: null })
  assert.equal(capabilities.response.status, 200)
  assert.equal(capabilities.data.capabilities.scopedRoleCrud, true)
  assert.equal(capabilities.data.capabilities.explicitRowGrants, true)
  assert.equal(capabilities.data.capabilities.scopedRealtime, false)

  console.log('PASS IZAKHONO Core Policy Engine E2E')
  console.log('  ✓ centre-scoped Owner/Principal/Teacher/Accountant access primitives')
  console.log('  ✓ Parent-style explicit child row grant without centre-wide access')
  console.log('  ✓ cross-centre reads and writes denied')
  console.log('  ✓ write roles are narrower than read roles')
  console.log('  ✓ scoped realtime remains explicitly unclaimed')
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([once(child, 'exit'), sleep(5000)])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  if (child.exitCode && child.exitCode !== 0) {
    console.error(stdout)
    console.error(stderr)
  }
}
