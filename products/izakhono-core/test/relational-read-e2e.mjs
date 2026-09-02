import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'

const port = Number(process.env.IZ_CORE_RELATION_TEST_PORT || 18791)
const base = `http://127.0.0.1:${port}`
const adminToken = 'ci-relation-admin-token-0123456789-abcdefghijklmnopqrstuvwxyz'
const jwtSecret = 'ci-relation-jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const project = `relation-ci-${Date.now()}`
const projectKey = 'pk_relation_ci_0123456789_abcdefghijklmnopqrstuvwxyz'

const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    IZAKHONO_CORE_ADMIN_TOKEN: adminToken,
    IZAKHONO_CORE_JWT_SECRET: jwtSecret,
    IZAKHONO_CORE_STORAGE_DIR: `/tmp/izakhono-relation-${process.pid}`,
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
  const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
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

async function signup(label) {
  const email = `${label}@relations.example.test`
  const result = await jsonCall(`/v1/auth/${project}/signup`, { method: 'POST', body: { email, password: 'Relation-Strong-123!' } })
  assert.equal(result.response.status, 201, `signup failed for ${email}: ${JSON.stringify(result.data)}`)
  return { ...result.data, email }
}

async function setPolicy(table, readRoles, writeRoles) {
  const result = await jsonCall('/v2/admin/policies', {
    method: 'POST', key: null, token: adminToken,
    body: { project, table, mode: 'scope', scope_field: 'centre_id', read_roles: readRoles, write_roles: writeRoles },
  })
  assert.equal(result.response.status, 200, `policy failed for ${table}: ${JSON.stringify(result.data)}`)
}

async function membership(user, scopeId, role) {
  const result = await jsonCall('/v2/admin/memberships', {
    method: 'POST', key: null, token: adminToken,
    body: { project, email: user.email, scope_id: scopeId, role },
  })
  assert.equal(result.response.status, 200, `membership failed for ${user.email}: ${JSON.stringify(result.data)}`)
}

async function insert(token, table, data) {
  const result = await jsonCall(`/v2/data/${project}/${table}`, { method: 'POST', token, body: { data } })
  assert.equal(result.response.status, 201, `insert failed for ${table}: ${JSON.stringify(result.data)}`)
  return result.data
}

async function relational(token, body) {
  return jsonCall(`/v3/relations/${project}/read`, { method: 'POST', token, body })
}

try {
  await waitHealthy()

  let result = await jsonCall('/v1/admin/projects', {
    method: 'POST', key: null, token: adminToken,
    body: { project, public_key: projectKey, allow_signup: true },
  })
  assert.equal(result.response.status, 201)

  const owner = await signup('owner')
  const teacher = await signup('teacher')
  const accountant = await signup('accountant')
  const parent = await signup('parent')
  const secondOwner = await signup('second-owner')

  await setPolicy('children', ['owner', 'principal', 'teacher'], ['owner', 'principal'])
  await setPolicy('classroom_observations', ['owner', 'principal', 'teacher'], ['owner', 'principal', 'teacher'])
  await setPolicy('invoices', ['owner', 'principal', 'accountant'], ['owner', 'principal', 'accountant'])

  await membership(owner, 'centre-a', 'owner')
  await membership(teacher, 'centre-a', 'teacher')
  await membership(accountant, 'centre-a', 'accountant')
  await membership(secondOwner, 'centre-b', 'owner')

  await insert(owner.access_token, 'children', { id: 'child-a', centre_id: 'centre-a', name: 'Amina Synthetic' })
  await insert(owner.access_token, 'children', { id: 'child-a2', centre_id: 'centre-a', name: 'Busi Synthetic' })
  await insert(secondOwner.access_token, 'children', { id: 'child-b', centre_id: 'centre-b', name: 'Other Centre Child' })
  await insert(teacher.access_token, 'classroom_observations', { id: 'obs-a', centre_id: 'centre-a', child_id: 'child-a', note: 'Synthetic observation' })
  await insert(secondOwner.access_token, 'classroom_observations', { id: 'obs-b', centre_id: 'centre-b', child_id: 'child-b', note: 'Other centre observation' })
  await insert(owner.access_token, 'invoices', { id: 'invoice-a', centre_id: 'centre-a', child_id: 'child-a', total_cents: 95000 })

  result = await jsonCall('/v2/admin/row-grants', {
    method: 'POST', key: null, token: adminToken,
    body: { project, email: parent.email, table: 'children', row_id: 'child-a', can_read: true, can_write: false },
  })
  assert.equal(result.response.status, 200)

  result = await jsonCall('/v3/relations/capabilities', { key: null })
  assert.equal(result.response.status, 200)
  assert.equal(result.data.capabilities.policyAwareRelationalRead, true)
  assert.equal(result.data.capabilities.oneLevelRelations, true)
  assert.equal(result.data.capabilities.nestedPolicyEnforcement, true)
  assert.equal(result.data.capabilities.arbitrarySql, false)
  assert.equal(result.data.capabilities.mutations, false)

  result = await relational(owner.access_token, {
    from: 'invoices', fields: ['id', 'child_id', 'total_cents'], filters: { centre_id: 'centre-a' },
    relations: [{ as: 'child', table: 'children', local_field: 'child_id', foreign_field: 'id', cardinality: 'one', fields: ['id', 'name'] }],
  })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.equal(result.data.data.length, 1)
  assert.equal(result.data.data[0].child?.name, 'Amina Synthetic')

  result = await relational(accountant.access_token, {
    from: 'invoices', fields: ['id', 'child_id', 'total_cents'],
    relations: [{ as: 'child', table: 'children', local_field: 'child_id', foreign_field: 'id', cardinality: 'one', fields: ['id', 'name'] }],
  })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.deepEqual(result.data.data.map(row => row.id), ['invoice-a'])
  assert.equal(result.data.data[0].child, null, 'Accountant finance access must not leak protected child rows through a relation')

  result = await relational(teacher.access_token, {
    from: 'children', fields: ['id', 'name'], order: { field: 'id', direction: 'asc' },
    relations: [{ as: 'observations', table: 'classroom_observations', local_field: 'id', foreign_field: 'child_id', cardinality: 'many', fields: ['id', 'note'] }],
  })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.deepEqual(result.data.data.map(row => row.id), ['child-a', 'child-a2'])
  assert.deepEqual(result.data.data[0].observations.map(row => row.id), ['obs-a'])
  assert.deepEqual(result.data.data[1].observations, [])

  result = await relational(secondOwner.access_token, {
    from: 'children', fields: ['id', 'name'],
    relations: [{ as: 'observations', table: 'classroom_observations', local_field: 'id', foreign_field: 'child_id', cardinality: 'many', fields: ['id'] }],
  })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.deepEqual(result.data.data.map(row => row.id), ['child-b'], 'Second centre must remain isolated in root and nested rows')
  assert.deepEqual(result.data.data[0].observations.map(row => row.id), ['obs-b'])

  result = await relational(parent.access_token, {
    from: 'children', fields: ['id', 'name'],
    relations: [{ as: 'observations', table: 'classroom_observations', local_field: 'id', foreign_field: 'child_id', cardinality: 'many', fields: ['id', 'note'] }],
  })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.deepEqual(result.data.data.map(row => row.id), ['child-a'], 'Parent must see only explicitly granted child')
  assert.deepEqual(result.data.data[0].observations, [], 'Parent child grant must not transitively grant classroom observation access')

  result = await relational(owner.access_token, {
    from: 'invoices',
    relations: [{ as: 'unsafe', table: 'unconfigured_table', local_field: 'id', foreign_field: 'id', cardinality: 'one' }],
  })
  assert.equal(result.response.status, 409, 'Unconfigured relation tables must fail closed')

  result = await relational(owner.access_token, {
    from: 'invoices;drop_table', relations: [],
  })
  assert.equal(result.response.status, 400, 'Table identifiers must not become arbitrary SQL')

  console.log('PASS IZAKHONO Core policy-aware relational reads E2E')
  console.log('  ✓ one-level one/many relations preserve root and nested policy checks')
  console.log('  ✓ Accountant finance access cannot leak protected child data')
  console.log('  ✓ Parent row grants do not transitively grant nested-table access')
  console.log('  ✓ cross-centre root and nested isolation is preserved')
  console.log('  ✓ unconfigured relation tables and arbitrary SQL-shaped identifiers fail closed')
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([once(child, 'exit'), sleep(5000)])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
}
