import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'

const port = Number(process.env.IZ_CORE_RPC_TEST_PORT || 18793)
const base = `http://127.0.0.1:${port}`
const adminToken = 'ci-rpc-admin-token-0123456789-abcdefghijklmnopqrstuvwxyz'
const jwtSecret = 'ci-rpc-jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const project = `rpc-ci-${Date.now()}`
const projectKey = 'pk_rpc_ci_0123456789_abcdefghijklmnopqrstuvwxyz'

const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    IZAKHONO_CORE_ADMIN_TOKEN: adminToken,
    IZAKHONO_CORE_JWT_SECRET: jwtSecret,
    IZAKHONO_CORE_STORAGE_DIR: `/tmp/izakhono-rpc-${process.pid}`,
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
  const email = `${label}@rpc.example.test`
  const result = await jsonCall(`/v1/auth/${project}/signup`, { method: 'POST', body: { email, password: 'Rpc-Strong-123!' } })
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

async function rpc(token, name, params) {
  return jsonCall(`/v3/rpc/${project}/${name}`, { method: 'POST', token, body: { params } })
}

try {
  await waitHealthy()

  let result = await jsonCall('/v1/admin/projects', {
    method: 'POST', key: null, token: adminToken,
    body: { project, public_key: projectKey, allow_signup: true },
  })
  assert.equal(result.response.status, 201)

  const owner = await signup('owner')
  const accountant = await signup('accountant')
  const teacher = await signup('teacher')
  const secondOwner = await signup('second-owner')

  const financeRead = ['owner', 'principal', 'admin', 'accountant']
  const financeWrite = ['owner', 'principal', 'admin', 'accountant']
  for (const table of ['invoices', 'payments', 'expenses', 'finance_budgets', 'billing_profiles', 'billing_adjustments']) {
    await setPolicy(table, financeRead, financeWrite)
  }

  await membership(owner, 'centre-a', 'owner')
  await membership(accountant, 'centre-a', 'accountant')
  await membership(teacher, 'centre-a', 'teacher')
  await membership(secondOwner, 'centre-b', 'owner')

  await insert(owner.access_token, 'invoices', { id: 'invoice-a', centre_id: 'centre-a', issue_date: '2026-09-02', total: 950, status: 'issued' })
  await insert(owner.access_token, 'payments', { id: 'payment-a', centre_id: 'centre-a', payment_date: '2026-09-05', allocated_amount: 950, verified: true })
  await insert(owner.access_token, 'expenses', { id: 'expense-a', centre_id: 'centre-a', expense_date: '2026-09-06', amount: 200, category: 'Food', status: 'posted' })
  await insert(owner.access_token, 'finance_budgets', { id: 'budget-a', centre_id: 'centre-a', budget_month: '2026-09-01', category: 'Food', planned_amount: 300 })
  await insert(owner.access_token, 'billing_profiles', { id: 'profile-a', centre_id: 'centre-a', child_id: 'child-a', base_fee: 950, proration_policy: 'none', start_date: '2026-01-01', active: true })
  await insert(owner.access_token, 'billing_adjustments', { id: 'adjustment-a', centre_id: 'centre-a', child_id: 'child-a', kind: 'fixed_discount', amount: 50, recurrence: 'monthly', starts_on: '2026-01-01', active: true })

  await insert(secondOwner.access_token, 'invoices', { id: 'invoice-b', centre_id: 'centre-b', issue_date: '2026-09-02', total: 5000, status: 'issued' })
  await insert(secondOwner.access_token, 'payments', { id: 'payment-b', centre_id: 'centre-b', payment_date: '2026-09-03', allocated_amount: 5000, verified: true })
  await insert(secondOwner.access_token, 'expenses', { id: 'expense-b', centre_id: 'centre-b', expense_date: '2026-09-04', amount: 1000, category: 'Food', status: 'posted' })
  await insert(secondOwner.access_token, 'finance_budgets', { id: 'budget-b', centre_id: 'centre-b', budget_month: '2026-09-01', category: 'Food', planned_amount: 2000 })
  await insert(secondOwner.access_token, 'billing_profiles', { id: 'profile-b', centre_id: 'centre-b', child_id: 'child-b', base_fee: 5000, proration_policy: 'none', start_date: '2026-01-01', active: true })
  await insert(secondOwner.access_token, 'billing_adjustments', { id: 'adjustment-b', centre_id: 'centre-b', child_id: 'child-b', kind: 'fixed_discount', amount: 1000, recurrence: 'monthly', starts_on: '2026-01-01', active: true })

  result = await jsonCall('/v3/rpc/capabilities', { key: null })
  assert.equal(result.response.status, 200)
  assert.equal(result.data.capabilities.namedReadProcedures, true)
  assert.equal(result.data.capabilities.policyAwareCentreScope, true)
  assert.equal(result.data.capabilities.readOnlyTransactions, true)
  assert.equal(result.data.capabilities.arbitrarySql, false)
  assert.equal(result.data.capabilities.mutations, false)
  assert.equal(result.data.capabilities.dynamicProcedureRegistration, false)
  assert.deepEqual(result.data.procedures.sort(), ['finance_budget_vs_actual', 'finance_cashflow_summary', 'finance_monthly_billing_preview'])

  result = await rpc(owner.access_token, 'finance_cashflow_summary', { p_centre_id: 'centre-a', p_from: '2026-09-01', p_to: '2026-09-30' })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.deepEqual(result.data.data, [{ month: '2026-09-01', invoiced: 950, verified_collections: 950, expenses: 200, net_cash_movement: 750 }])

  result = await rpc(accountant.access_token, 'finance_cashflow_summary', { p_centre_id: 'centre-a', p_from: '2026-09-01', p_to: '2026-09-30' })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.equal(result.data.data[0].invoiced, 950, 'Accountant must receive centre-a only')

  result = await rpc(secondOwner.access_token, 'finance_cashflow_summary', { p_centre_id: 'centre-b', p_from: '2026-09-01', p_to: '2026-09-30' })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.deepEqual(result.data.data, [{ month: '2026-09-01', invoiced: 5000, verified_collections: 5000, expenses: 1000, net_cash_movement: 4000 }])

  result = await rpc(secondOwner.access_token, 'finance_cashflow_summary', { p_centre_id: 'centre-a', p_from: '2026-09-01', p_to: '2026-09-30' })
  assert.equal(result.response.status, 403, 'Cross-centre RPC must fail closed')

  result = await rpc(teacher.access_token, 'finance_cashflow_summary', { p_centre_id: 'centre-a', p_from: '2026-09-01', p_to: '2026-09-30' })
  assert.equal(result.response.status, 403, 'Teacher must not obtain finance aggregates')

  result = await rpc(owner.access_token, 'finance_budget_vs_actual', { p_centre_id: 'centre-a', p_month: '2026-09-15' })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.deepEqual(result.data.data, [{ category: 'Food', planned: 300, actual: 200, variance: 100 }])

  result = await rpc(owner.access_token, 'finance_monthly_billing_preview', { p_centre_id: 'centre-a', p_period: '2026-09-15' })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.deepEqual(result.data.data, [{ child_id: 'child-a', base_amount: 950, adjustment_amount: -50, projected_total: 900 }])

  result = await rpc(owner.access_token, 'drop_table', { p_centre_id: 'centre-a' })
  assert.equal(result.response.status, 404, 'Unregistered RPC names must fail closed')

  result = await jsonCall(`/v3/rpc/${project}/finance_cashflow_summary;drop`, { method: 'POST', token: owner.access_token, body: { params: {} } })
  assert.equal(result.response.status, 400, 'SQL-shaped RPC names must be rejected')

  result = await rpc(owner.access_token, 'finance_cashflow_summary', { p_centre_id: 'centre-a', p_from: '2026-01-01', p_to: '2028-12-31' })
  assert.equal(result.response.status, 400, 'Unbounded report windows must fail closed')

  console.log('PASS IZAKHONO Core named read RPC E2E')
  console.log('  ✓ only compiled named procedures are callable; arbitrary SQL and dynamic registration stay disabled')
  console.log('  ✓ read-only finance summaries preserve centre-role isolation')
  console.log('  ✓ Accountant access is limited to the authorised centre and Teacher access is denied')
  console.log('  ✓ cross-centre aggregate leakage is blocked')
  console.log('  ✓ cashflow, budget-vs-actual and billing-preview procedures reproduce the first ECD360 read-only finance RPCs')
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([once(child, 'exit'), sleep(5000)])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
}
