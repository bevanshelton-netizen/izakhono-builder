import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const { Pool } = pg
const POLICY_VERSION = '0.2.0'
const JWT_SECRET = process.env.IZAKHONO_CORE_JWT_SECRET || ''
const ADMIN_TOKEN = process.env.IZAKHONO_CORE_ADMIN_TOKEN || ''
const ALLOWED_ORIGINS = new Set((process.env.IZAKHONO_CORE_ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean))
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : new Pool()
const migration = await readFile(new URL('../sql/002_policy_engine.sql', import.meta.url), 'utf8')
await pool.query(migration)

function httpError(status, message) {
  return Object.assign(new Error(message), { status })
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

function validateTable(value) {
  const table = String(value || '')
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(table)) throw httpError(400, 'Invalid table name')
  return table
}

function validateRowId(value) {
  const id = String(value || '')
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(id)) throw httpError(400, 'Invalid row id')
  return id
}

function validateField(value) {
  const field = String(value || '')
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(field)) throw httpError(400, 'Invalid field name')
  return field
}

function validateRole(value) {
  const role = String(value || '').trim().toLowerCase()
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(role)) throw httpError(400, 'Invalid role')
  return role
}

function validateScope(value) {
  const scope = String(value || '')
  if (!scope || scope.length > 160 || /[\r\n\0]/.test(scope)) throw httpError(400, 'Invalid scope id')
  return scope
}

function normalizeRoles(value) {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 32) throw httpError(400, 'Role list must be an array with at most 32 roles')
  return [...new Set(value.map(validateRole))]
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1024 * 1024) throw httpError(413, 'Request body too large')
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

function requireAdmin(req) {
  if (!safeEqual(authHeaderToken(req), ADMIN_TOKEN)) throw httpError(401, 'Invalid admin token')
}

async function requireProject(project, key) {
  if (!key) throw httpError(401, 'Project key required')
  const result = await pool.query('SELECT id FROM iz_core_projects WHERE id=$1 AND public_key_hash=$2', [project, sha256(key)])
  if (!result.rowCount) throw httpError(401, 'Invalid project key')
}

async function requireUser(req, project) {
  await requireProject(project, String(req.headers['x-project-key'] || ''))
  const payload = verifyAccessToken(authHeaderToken(req))
  if (payload.project !== project || payload.aud !== project) throw httpError(403, 'Token project mismatch')
  const result = await pool.query('SELECT id, project_id, email, disabled FROM iz_core_users WHERE id=$1 AND project_id=$2', [payload.sub, project])
  const user = result.rows[0]
  if (!user || user.disabled) throw httpError(401, 'User unavailable')
  return user
}

async function resolveUser(project, body) {
  let result
  if (body.user_id) result = await pool.query('SELECT id, email FROM iz_core_users WHERE project_id=$1 AND id=$2', [project, String(body.user_id)])
  else if (body.email) result = await pool.query('SELECT id, email FROM iz_core_users WHERE project_id=$1 AND lower(email)=lower($2)', [project, String(body.email).trim()])
  else throw httpError(400, 'user_id or email required')
  if (!result.rowCount) throw httpError(404, 'Project user not found')
  return result.rows[0]
}

async function audit(project, userId, eventType, detail = {}) {
  try {
    await pool.query(
      'INSERT INTO iz_core_audit(id,project_id,user_id,event_type,detail) VALUES(gen_random_uuid(),$1,$2,$3,$4::jsonb)',
      [project, userId || null, eventType, JSON.stringify(detail)],
    )
  } catch (error) {
    console.error('policy audit failure', error?.message || error)
  }
}

async function getPolicy(project, table) {
  const result = await pool.query(
    `SELECT mode, scope_field, read_roles, write_roles
     FROM iz_core_table_policies WHERE project_id=$1 AND table_name=$2`,
    [project, table],
  )
  return result.rows[0] || { mode: 'owner', scope_field: null, read_roles: [], write_roles: [] }
}

async function accessContext(project, table, userId, policy) {
  if (policy.mode !== 'scope') return { memberships: new Map(), grants: new Map() }
  const [memberships, grants] = await Promise.all([
    pool.query(
      'SELECT scope_id, role FROM iz_core_memberships WHERE project_id=$1 AND user_id=$2 AND active=true',
      [project, userId],
    ),
    pool.query(
      'SELECT row_id, can_read, can_write FROM iz_core_row_grants WHERE project_id=$1 AND table_name=$2 AND user_id=$3',
      [project, table, userId],
    ),
  ])
  const membershipMap = new Map()
  for (const row of memberships.rows) {
    if (!membershipMap.has(row.scope_id)) membershipMap.set(row.scope_id, new Set())
    membershipMap.get(row.scope_id).add(row.role)
  }
  return { memberships: membershipMap, grants: new Map(grants.rows.map(row => [row.row_id, row])) }
}

function hasAnyRole(ctx, scope, roles = []) {
  const actual = ctx.memberships.get(String(scope))
  return Boolean(actual && roles.some(role => actual.has(role)))
}

function rowScope(row, policy) {
  if (!policy.scope_field) return null
  const scope = row.data?.[policy.scope_field]
  return scope == null ? null : String(scope)
}

function canRead(row, user, policy, ctx) {
  if (policy.mode === 'project') return true
  if (policy.mode === 'owner') return row.created_by === user.id
  const scope = rowScope(row, policy)
  const grant = ctx.grants.get(row.row_id)
  return Boolean(scope && hasAnyRole(ctx, scope, policy.read_roles || [])) || Boolean(grant?.can_read || grant?.can_write)
}

function canWrite(row, user, policy, ctx) {
  if (policy.mode === 'project') return true
  if (policy.mode === 'owner') return row.created_by === user.id
  const scope = rowScope(row, policy)
  const grant = ctx.grants.get(row.row_id)
  return Boolean(scope && hasAnyRole(ctx, scope, policy.write_roles || [])) || Boolean(grant?.can_write)
}

function publicRow(row) {
  return { ...(row.data || {}), id: row.row_id }
}

async function handlePolicyAdmin(req, res, action) {
  requireAdmin(req)
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed')
  const body = await readJson(req)
  const project = validateProject(body.project)

  if (action === 'policies') {
    const table = validateTable(body.table)
    const mode = String(body.mode || 'owner')
    if (!['owner', 'project', 'scope'].includes(mode)) throw httpError(400, 'Invalid policy mode')
    const scopeField = mode === 'scope' ? validateField(body.scope_field) : null
    const readRoles = mode === 'scope' ? normalizeRoles(body.read_roles) : []
    const writeRoles = mode === 'scope' ? normalizeRoles(body.write_roles) : []
    if (mode === 'scope' && !readRoles.length) throw httpError(400, 'scope policy requires read_roles')
    await pool.query(
      `INSERT INTO iz_core_table_policies(project_id,table_name,mode,scope_field,read_roles,write_roles)
       VALUES($1,$2,$3,$4,$5::text[],$6::text[])
       ON CONFLICT(project_id,table_name) DO UPDATE SET
         mode=EXCLUDED.mode, scope_field=EXCLUDED.scope_field,
         read_roles=EXCLUDED.read_roles, write_roles=EXCLUDED.write_roles, updated_at=now()`,
      [project, table, mode, scopeField, readRoles, writeRoles],
    )
    await audit(project, null, 'policy.updated', { table, mode, scope_field: scopeField, read_roles: readRoles, write_roles: writeRoles })
    return sendJson(req, res, 200, { ok: true, project, table, mode, scope_field: scopeField, read_roles: readRoles, write_roles: writeRoles })
  }

  if (action === 'memberships') {
    const user = await resolveUser(project, body)
    const scope = validateScope(body.scope_id)
    const role = validateRole(body.role)
    const active = body.active !== false
    await pool.query(
      `INSERT INTO iz_core_memberships(project_id,user_id,scope_id,role,active)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(project_id,user_id,scope_id,role) DO UPDATE SET active=EXCLUDED.active,updated_at=now()`,
      [project, user.id, scope, role, active],
    )
    await audit(project, user.id, 'membership.updated', { scope_id: scope, role, active })
    return sendJson(req, res, 200, { ok: true, user_id: user.id, email: user.email, scope_id: scope, role, active })
  }

  if (action === 'row-grants') {
    const user = await resolveUser(project, body)
    const table = validateTable(body.table)
    const rowId = validateRowId(body.row_id)
    const canRead = body.can_read !== false
    const canWrite = body.can_write === true
    const exists = await pool.query('SELECT 1 FROM iz_core_rows WHERE project_id=$1 AND table_name=$2 AND row_id=$3', [project, table, rowId])
    if (!exists.rowCount) throw httpError(404, 'Row not found')
    await pool.query(
      `INSERT INTO iz_core_row_grants(project_id,table_name,row_id,user_id,can_read,can_write)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(project_id,table_name,row_id,user_id) DO UPDATE SET
         can_read=EXCLUDED.can_read,can_write=EXCLUDED.can_write,updated_at=now()`,
      [project, table, rowId, user.id, canRead, canWrite],
    )
    await audit(project, user.id, 'row_grant.updated', { table, row_id: rowId, can_read: canRead, can_write: canWrite })
    return sendJson(req, res, 200, { ok: true, user_id: user.id, email: user.email, table, row_id: rowId, can_read: canRead, can_write: canWrite })
  }

  throw httpError(404, 'Not found')
}

async function handleCollection(req, res, url, project, table) {
  const user = await requireUser(req, project)
  const policy = await getPolicy(project, table)
  const ctx = await accessContext(project, table, user.id, policy)

  if (req.method === 'GET') {
    const values = [project, table]
    const clauses = ['project_id=$1', 'table_name=$2']
    for (const [rawKey, rawValue] of url.searchParams.entries()) {
      if (['order', 'limit', 'offset'].includes(rawKey)) continue
      const field = validateField(rawKey)
      values.push(field)
      const fieldParam = values.length
      values.push(String(rawValue))
      clauses.push(`data ->> $${fieldParam} = $${values.length}`)
    }
    const result = await pool.query(
      `SELECT row_id,data,created_by,updated_at FROM iz_core_rows
       WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC LIMIT 2000`,
      values,
    )
    let rows = result.rows.filter(row => canRead(row, user, policy, ctx))
    const order = url.searchParams.get('order')
    if (order) {
      const match = order.match(/^([A-Za-z_][A-Za-z0-9_]{0,62})\.(asc|desc)$/)
      if (!match) throw httpError(400, 'Invalid order expression')
      const [, field, direction] = match
      rows.sort((a, b) => {
        const av = field === 'id' ? a.row_id : a.data?.[field]
        const bv = field === 'id' ? b.row_id : b.data?.[field]
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''))
        return direction === 'asc' ? cmp : -cmp
      })
    }
    const offset = Math.min(100000, Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0))
    const limit = Math.min(200, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '100', 10) || 100))
    rows = rows.slice(offset, offset + limit)
    return sendJson(req, res, 200, rows.map(publicRow))
  }

  if (req.method === 'POST') {
    const body = await readJson(req)
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw httpError(400, 'data object required')
    const data = { ...body.data }
    const rowId = data.id ? validateRowId(data.id) : crypto.randomUUID()
    delete data.id
    if (policy.mode === 'scope') {
      const scope = data[policy.scope_field]
      if (scope == null || !hasAnyRole(ctx, String(scope), policy.write_roles || [])) throw httpError(403, 'No write access to this scope')
    }
    try {
      const result = await pool.query(
        `INSERT INTO iz_core_rows(project_id,table_name,row_id,data,created_by)
         VALUES($1,$2,$3,$4::jsonb,$5) RETURNING row_id,data,created_by,updated_at`,
        [project, table, rowId, JSON.stringify(data), user.id],
      )
      await audit(project, user.id, 'policy_data.insert', { table, row_id: rowId, mode: policy.mode })
      return sendJson(req, res, 201, publicRow(result.rows[0]))
    } catch (error) {
      if (error?.code === '23505') throw httpError(409, 'Row already exists')
      throw error
    }
  }

  throw httpError(405, 'Method not allowed')
}

async function handleRow(req, res, project, table, rowId) {
  const user = await requireUser(req, project)
  const policy = await getPolicy(project, table)
  const found = await pool.query(
    'SELECT row_id,data,created_by,updated_at FROM iz_core_rows WHERE project_id=$1 AND table_name=$2 AND row_id=$3',
    [project, table, rowId],
  )
  const row = found.rows[0]
  if (!row) throw httpError(404, 'Row not found')
  const ctx = await accessContext(project, table, user.id, policy)

  if (req.method === 'GET') {
    if (!canRead(row, user, policy, ctx)) throw httpError(404, 'Row not found')
    return sendJson(req, res, 200, publicRow(row))
  }

  if (req.method === 'PATCH') {
    if (!canWrite(row, user, policy, ctx)) throw httpError(404, 'Row not found')
    const body = await readJson(req)
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw httpError(400, 'data object required')
    const patch = { ...body.data }
    delete patch.id
    const prospective = { ...row, data: { ...(row.data || {}), ...patch } }
    if (policy.mode === 'scope' && !canWrite(prospective, user, policy, ctx)) throw httpError(403, 'Cannot move row into an unauthorized scope')
    const updated = await pool.query(
      `UPDATE iz_core_rows SET data=data || $4::jsonb,updated_at=now()
       WHERE project_id=$1 AND table_name=$2 AND row_id=$3 RETURNING row_id,data,created_by,updated_at`,
      [project, table, rowId, JSON.stringify(patch)],
    )
    await audit(project, user.id, 'policy_data.update', { table, row_id: rowId, mode: policy.mode })
    return sendJson(req, res, 200, publicRow(updated.rows[0]))
  }

  if (req.method === 'DELETE') {
    if (!canWrite(row, user, policy, ctx)) throw httpError(404, 'Row not found')
    await pool.query('DELETE FROM iz_core_row_grants WHERE project_id=$1 AND table_name=$2 AND row_id=$3', [project, table, rowId])
    await pool.query('DELETE FROM iz_core_rows WHERE project_id=$1 AND table_name=$2 AND row_id=$3', [project, table, rowId])
    await audit(project, user.id, 'policy_data.delete', { table, row_id: rowId, mode: policy.mode })
    return sendJson(req, res, 200, publicRow(row))
  }

  throw httpError(405, 'Method not allowed')
}

export async function handlePolicyRequest(req, res) {
  const rawUrl = req.url || '/'
  if (!rawUrl.startsWith('/v2/')) return false
  assertOrigin(req)
  const url = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/v2/capabilities') {
    sendJson(req, res, 200, {
      service: 'IZAKHONO Core Policy Engine',
      version: POLICY_VERSION,
      capabilities: {
        scopedRoleCrud: true,
        explicitRowGrants: true,
        centreStyleIsolationPrimitive: true,
        scopedRealtime: false,
        relationalSelect: false,
        rpc: false,
        edgeFunctions: false,
      },
    })
    return true
  }

  let match = url.pathname.match(/^\/v2\/admin\/(policies|memberships|row-grants)$/)
  if (match) {
    await handlePolicyAdmin(req, res, match[1])
    return true
  }

  match = url.pathname.match(/^\/v2\/data\/([^/]+)\/([^/]+)$/)
  if (match) {
    const project = validateProject(decodeURIComponent(match[1]))
    const table = validateTable(decodeURIComponent(match[2]))
    await handleCollection(req, res, url, project, table)
    return true
  }

  match = url.pathname.match(/^\/v2\/data\/([^/]+)\/([^/]+)\/([^/]+)$/)
  if (match) {
    const project = validateProject(decodeURIComponent(match[1]))
    const table = validateTable(decodeURIComponent(match[2]))
    const rowId = validateRowId(decodeURIComponent(match[3]))
    await handleRow(req, res, project, table, rowId)
    return true
  }

  throw httpError(404, 'Not found')
}

export async function closePolicyRuntime() {
  await pool.end()
}
