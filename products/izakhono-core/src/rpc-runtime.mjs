import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import pg from 'pg'

const { Pool } = pg
const RPC_VERSION = '0.2.0-rpc-preview'
const JWT_SECRET = process.env.IZAKHONO_CORE_JWT_SECRET || ''
const ALLOWED_ORIGINS = new Set((process.env.IZAKHONO_CORE_ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean))
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : new Pool()
const MAX_SOURCE_ROWS = 5000

function httpError(status, message, code) {
  return Object.assign(new Error(message), { status, ...(code ? { code } : {}) })
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function authHeaderToken(req) {
  return String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1] || ''
}

function verifyAccessToken(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) throw httpError(401, 'Invalid access token')
  const [headerPart, payloadPart, signature] = parts
  const expected = createHmac('sha256', JWT_SECRET).update(`${headerPart}.${payloadPart}`).digest('base64url')
  if (!safeEqual(signature, expected)) throw httpError(401, 'Invalid access token')
  let header
  let payload
  try {
    header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'))
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
  } catch {
    throw httpError(401, 'Invalid access token')
  }
  const now = Math.floor(Date.now() / 1000)
  if (header.alg !== 'HS256' || payload.iss !== 'izakhono-core' || !payload.sub || !payload.project || payload.exp <= now) {
    throw httpError(401, 'Expired or invalid access token')
  }
  return payload
}

function validateProject(value) {
  const project = String(value || '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project) || project.length > 64) throw httpError(400, 'Invalid project id')
  return project
}

function validateProcedure(value) {
  const procedure = String(value || '')
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(procedure)) throw httpError(400, 'Invalid RPC name')
  return procedure
}

function validateScope(value) {
  const scope = String(value || '')
  if (!scope || scope.length > 160 || /[\r\n\0]/.test(scope)) throw httpError(400, 'Invalid centre id')
  return scope
}

function parseDate(value, label) {
  const date = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw httpError(400, `${label} must be YYYY-MM-DD`)
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw httpError(400, `${label} is invalid`)
  return date
}

function monthStart(value) {
  const date = parseDate(value, 'date')
  return `${date.slice(0, 7)}-01`
}

function monthEnd(month) {
  const d = new Date(`${month}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCDate(0)
  return d.toISOString().slice(0, 10)
}

function monthKey(value) {
  return value ? monthStart(String(value).slice(0, 10)) : null
}

function addMonths(month, delta) {
  const d = new Date(`${month}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + delta)
  return d.toISOString().slice(0, 10)
}

function monthsBetween(from, to) {
  const start = monthStart(from)
  const end = monthStart(to)
  const out = []
  let current = start
  while (current <= end) {
    out.push(current)
    if (out.length > 24) throw httpError(400, 'RPC date range may not exceed 24 months')
    current = addMonths(current, 1)
  }
  return out
}

function number(value, label) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) throw httpError(409, `Invalid numeric value in ${label}`)
  return n
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function bool(value) {
  return value === true || String(value).toLowerCase() === 'true'
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 128 * 1024) throw httpError(413, 'Request body too large')
    chunks.push(chunk)
  }
  if (!size) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw httpError(400, 'Invalid JSON body') }
}

function sendJson(req, res, status, data) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  }
  const origin = req.headers.origin
  if (origin && (ALLOWED_ORIGINS.has(origin) || ALLOWED_ORIGINS.has('*'))) {
    headers['access-control-allow-origin'] = origin
    headers.vary = 'Origin'
  }
  res.writeHead(status, headers)
  res.end(JSON.stringify(data))
}

function assertOrigin(req) {
  const origin = req.headers.origin
  if (origin && !ALLOWED_ORIGINS.has(origin) && !ALLOWED_ORIGINS.has('*')) throw httpError(403, 'Origin not allowed')
}

async function requireUser(req, project) {
  const key = String(req.headers['x-project-key'] || '')
  if (!key) throw httpError(401, 'Project key required')
  const projectResult = await pool.query('SELECT id FROM iz_core_projects WHERE id=$1 AND public_key_hash=$2', [project, sha256(key)])
  if (!projectResult.rowCount) throw httpError(401, 'Invalid project key')
  const payload = verifyAccessToken(authHeaderToken(req))
  if (payload.project !== project || payload.aud !== project) throw httpError(403, 'Token project mismatch')
  const userResult = await pool.query('SELECT id,project_id,email,disabled FROM iz_core_users WHERE id=$1 AND project_id=$2', [payload.sub, project])
  const user = userResult.rows[0]
  if (!user || user.disabled) throw httpError(401, 'User unavailable')
  return user
}

async function audit(project, userId, eventType, detail = {}) {
  try {
    await pool.query(
      'INSERT INTO iz_core_audit(id,project_id,user_id,event_type,detail) VALUES(gen_random_uuid(),$1,$2,$3,$4::jsonb)',
      [project, userId || null, eventType, JSON.stringify(detail)],
    )
  } catch (error) {
    console.error('rpc audit failure', error?.message || error)
  }
}

async function requireCentreReadRole(client, project, table, userId, centreId) {
  const policyResult = await client.query(
    `SELECT mode,scope_field,read_roles
     FROM iz_core_table_policies WHERE project_id=$1 AND table_name=$2`,
    [project, table],
  )
  if (!policyResult.rowCount) throw httpError(409, `RPC requires an explicit policy for ${table}`, 'IZAKHONO_RPC_POLICY_REQUIRED')
  const policy = policyResult.rows[0]
  if (policy.mode !== 'scope' || policy.scope_field !== 'centre_id' || !Array.isArray(policy.read_roles) || !policy.read_roles.length) {
    throw httpError(409, `RPC requires centre-scoped read policy for ${table}`, 'IZAKHONO_RPC_POLICY_REQUIRED')
  }
  const membershipResult = await client.query(
    'SELECT role FROM iz_core_memberships WHERE project_id=$1 AND user_id=$2 AND scope_id=$3 AND active=true',
    [project, userId, centreId],
  )
  const roles = new Set(membershipResult.rows.map(row => row.role))
  if (!policy.read_roles.some(role => roles.has(role))) throw httpError(403, `Not authorised to read ${table} for this centre`)
}

async function readCentreRows(client, project, table, userId, centreId) {
  await requireCentreReadRole(client, project, table, userId, centreId)
  const result = await client.query(
    `SELECT row_id,data,created_at,updated_at
     FROM iz_core_rows
     WHERE project_id=$1 AND table_name=$2 AND data->>'centre_id'=$3
     ORDER BY updated_at DESC LIMIT $4`,
    [project, table, centreId, MAX_SOURCE_ROWS + 1],
  )
  if (result.rows.length > MAX_SOURCE_ROWS) throw httpError(413, `RPC source ${table} exceeds ${MAX_SOURCE_ROWS} rows; use a bounded reporting period`)
  return result.rows
}

function paramsFrom(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'RPC body must be an object')
  if (body.params == null) return {}
  if (typeof body.params !== 'object' || Array.isArray(body.params)) throw httpError(400, 'RPC params must be an object')
  return body.params
}

async function financeCashflowSummary({ client, project, user, params }) {
  const centreId = validateScope(params.p_centre_id)
  const from = parseDate(params.p_from, 'p_from')
  const to = parseDate(params.p_to, 'p_to')
  if (from > to) throw httpError(400, 'p_from must be on or before p_to')
  const months = monthsBetween(from, to)
  const [invoices, payments, expenses] = await Promise.all([
    readCentreRows(client, project, 'invoices', user.id, centreId),
    readCentreRows(client, project, 'payments', user.id, centreId),
    readCentreRows(client, project, 'expenses', user.id, centreId),
  ])
  const out = new Map(months.map(month => [month, { month, invoiced: 0, verified_collections: 0, expenses: 0, net_cash_movement: 0 }]))
  for (const row of invoices) {
    if (String(row.data?.status || '') === 'void') continue
    const key = monthKey(row.data?.issue_date || row.created_at?.toISOString?.() || row.created_at)
    if (out.has(key)) out.get(key).invoiced += number(row.data?.total, 'invoices.total')
  }
  for (const row of payments) {
    if (!bool(row.data?.verified)) continue
    const key = monthKey(row.data?.payment_date)
    if (out.has(key)) out.get(key).verified_collections += number(row.data?.allocated_amount, 'payments.allocated_amount')
  }
  for (const row of expenses) {
    if (String(row.data?.status || '') === 'void') continue
    const key = monthKey(row.data?.expense_date)
    if (out.has(key)) out.get(key).expenses += number(row.data?.amount, 'expenses.amount')
  }
  return [...out.values()].map(row => ({
    ...row,
    invoiced: roundMoney(row.invoiced),
    verified_collections: roundMoney(row.verified_collections),
    expenses: roundMoney(row.expenses),
    net_cash_movement: roundMoney(row.verified_collections - row.expenses),
  }))
}

async function financeBudgetVsActual({ client, project, user, params }) {
  const centreId = validateScope(params.p_centre_id)
  const month = monthStart(parseDate(params.p_month, 'p_month'))
  const [budgets, expenses] = await Promise.all([
    readCentreRows(client, project, 'finance_budgets', user.id, centreId),
    readCentreRows(client, project, 'expenses', user.id, centreId),
  ])
  const planned = new Map()
  const actual = new Map()
  for (const row of budgets) {
    if (monthKey(row.data?.budget_month) !== month) continue
    const category = String(row.data?.category || '').trim() || 'Uncategorised'
    planned.set(category, (planned.get(category) || 0) + number(row.data?.planned_amount, 'finance_budgets.planned_amount'))
  }
  for (const row of expenses) {
    if (String(row.data?.status || '') === 'void' || monthKey(row.data?.expense_date) !== month) continue
    const category = String(row.data?.category || '').trim() || 'Uncategorised'
    actual.set(category, (actual.get(category) || 0) + number(row.data?.amount, 'expenses.amount'))
  }
  const categories = [...new Set([...planned.keys(), ...actual.keys()])].sort((a, b) => a.localeCompare(b))
  return categories.map(category => {
    const p = roundMoney(planned.get(category) || 0)
    const a = roundMoney(actual.get(category) || 0)
    return { category, planned: p, actual: a, variance: roundMoney(p - a) }
  })
}

async function financeMonthlyBillingPreview({ client, project, user, params }) {
  const centreId = validateScope(params.p_centre_id)
  const period = monthStart(parseDate(params.p_period, 'p_period'))
  const periodEnd = monthEnd(period)
  const [profiles, adjustments] = await Promise.all([
    readCentreRows(client, project, 'billing_profiles', user.id, centreId),
    readCentreRows(client, project, 'billing_adjustments', user.id, centreId),
  ])
  const byChild = new Map()
  for (const row of adjustments) {
    const data = row.data || {}
    if (!bool(data.active)) continue
    const starts = parseDate(data.starts_on || period, 'billing_adjustments.starts_on')
    const ends = data.ends_on ? parseDate(data.ends_on, 'billing_adjustments.ends_on') : null
    if (starts > periodEnd || (ends && ends < period)) continue
    if (String(data.recurrence || 'once') !== 'monthly' && number(data.remaining_uses, 'billing_adjustments.remaining_uses') <= 0) continue
    const childId = String(data.child_id || '')
    if (!byChild.has(childId)) byChild.set(childId, [])
    byChild.get(childId).push(data)
  }
  const result = []
  for (const row of profiles) {
    const data = row.data || {}
    if (!bool(data.active)) continue
    const childId = String(data.child_id || '')
    if (!childId) continue
    const start = parseDate(data.start_date || period, 'billing_profiles.start_date')
    const end = data.end_date ? parseDate(data.end_date, 'billing_profiles.end_date') : null
    if (start > periodEnd || (end && end < period)) continue
    let base = number(data.base_fee, 'billing_profiles.base_fee')
    if (String(data.proration_policy || 'none') === 'daily' && start >= period && start <= periodEnd) {
      const startDate = new Date(`${start}T00:00:00Z`)
      const endDate = new Date(`${periodEnd}T00:00:00Z`)
      const monthDate = new Date(`${period}T00:00:00Z`)
      const remainingDays = Math.floor((endDate - startDate) / 86400000) + 1
      const monthDays = Math.floor((endDate - monthDate) / 86400000) + 1
      base = base * (remainingDays / monthDays)
    }
    base = roundMoney(base)
    let adjustment = 0
    for (const item of byChild.get(childId) || []) {
      const kind = String(item.kind || '')
      if (kind === 'fixed_charge' || kind === 'deposit') adjustment += number(item.amount, 'billing_adjustments.amount')
      else if (kind === 'fixed_discount' || kind === 'credit') adjustment -= number(item.amount, 'billing_adjustments.amount')
      else if (kind === 'percent_discount') adjustment -= base * number(item.percentage, 'billing_adjustments.percentage') / 100
    }
    adjustment = roundMoney(adjustment)
    result.push({ child_id: childId, base_amount: base, adjustment_amount: adjustment, projected_total: Math.max(roundMoney(base + adjustment), 0) })
  }
  return result.sort((a, b) => a.child_id.localeCompare(b.child_id))
}

const PROCEDURES = Object.freeze({
  finance_cashflow_summary: financeCashflowSummary,
  finance_budget_vs_actual: financeBudgetVsActual,
  finance_monthly_billing_preview: financeMonthlyBillingPreview,
})

async function invoke(req, res, project, procedure) {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed')
  const handler = PROCEDURES[procedure]
  if (!handler) throw httpError(404, 'RPC not found')
  const user = await requireUser(req, project)
  const body = await readJson(req)
  const params = paramsFrom(body)
  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    const data = await handler({ client, project, user, params })
    await client.query('COMMIT')
    await audit(project, user.id, 'named_read_rpc', { procedure, result_count: Array.isArray(data) ? data.length : 1 })
    return sendJson(req, res, 200, { data })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    throw error
  } finally {
    client.release()
  }
}

export async function handleRpcRequest(req, res) {
  const rawUrl = req.url || '/'
  if (!rawUrl.startsWith('/v3/rpc/')) return false
  assertOrigin(req)
  const url = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/v3/rpc/capabilities') {
    sendJson(req, res, 200, {
      service: 'IZAKHONO Core Named Read RPC',
      version: RPC_VERSION,
      procedures: Object.keys(PROCEDURES),
      capabilities: {
        namedReadProcedures: true,
        policyAwareCentreScope: true,
        readOnlyTransactions: true,
        arbitrarySql: false,
        mutations: false,
        dynamicProcedureRegistration: false,
      },
    })
    return true
  }

  const match = url.pathname.match(/^\/v3\/rpc\/([^/]+)\/([^/]+)$/)
  if (match) {
    const project = validateProject(decodeURIComponent(match[1]))
    const procedure = validateProcedure(decodeURIComponent(match[2]))
    await invoke(req, res, project, procedure)
    return true
  }

  throw httpError(404, 'Not found')
}

export async function closeRpcRuntime() {
  await pool.end()
}
