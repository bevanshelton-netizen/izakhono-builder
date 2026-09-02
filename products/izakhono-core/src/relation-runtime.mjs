import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import pg from 'pg'

const { Pool } = pg
const RELATION_VERSION = '0.2.0-relations-preview'
const JWT_SECRET = process.env.IZAKHONO_CORE_JWT_SECRET || ''
const ALLOWED_ORIGINS = new Set((process.env.IZAKHONO_CORE_ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean))
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : new Pool()

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

function validateTable(value) {
  const table = String(value || '')
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(table)) throw httpError(400, 'Invalid table name')
  return table
}

function validateField(value) {
  const field = String(value || '')
  if (field === 'id') return field
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(field)) throw httpError(400, 'Invalid field name')
  return field
}

function validateAlias(value) {
  const alias = String(value || '')
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(alias)) throw httpError(400, 'Invalid relation alias')
  return alias
}

function normalizeFields(value, label) {
  if (value == null) return null
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) throw httpError(400, `${label} must contain between 1 and 64 fields`)
  return [...new Set(value.map(validateField))]
}

function normalizeFilters(value) {
  if (value == null) return []
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'filters must be an object')
  const entries = Object.entries(value)
  if (entries.length > 16) throw httpError(400, 'filters supports at most 16 fields')
  return entries.map(([field, expected]) => ({ field: validateField(field), expected: expected == null ? null : String(expected) }))
}

function normalizeOrder(value) {
  if (value == null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'order must be an object')
  const direction = String(value.direction || 'asc').toLowerCase()
  if (!['asc', 'desc'].includes(direction)) throw httpError(400, 'order.direction must be asc or desc')
  return { field: validateField(value.field), direction }
}

function normalizeRelation(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, `relations[${index}] must be an object`)
  const cardinality = String(value.cardinality || 'many').toLowerCase()
  if (!['one', 'many'].includes(cardinality)) throw httpError(400, `relations[${index}].cardinality must be one or many`)
  return {
    as: validateAlias(value.as),
    table: validateTable(value.table),
    localField: validateField(value.local_field),
    foreignField: validateField(value.foreign_field),
    cardinality,
    fields: normalizeFields(value.fields, `relations[${index}].fields`),
  }
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 256 * 1024) throw httpError(413, 'Request body too large')
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
    console.error('relation audit failure', error?.message || error)
  }
}

async function policyFor(client, project, table) {
  const result = await client.query(
    `SELECT mode,scope_field,read_roles
     FROM iz_core_table_policies WHERE project_id=$1 AND table_name=$2`,
    [project, table],
  )
  if (!result.rowCount) throw httpError(409, `Relational read requires an explicit policy for ${table}`, 'IZAKHONO_RELATION_POLICY_REQUIRED')
  const policy = result.rows[0]
  if (policy.mode === 'scope' && (!policy.scope_field || !Array.isArray(policy.read_roles) || !policy.read_roles.length)) {
    throw httpError(409, `Relational read requires readable scope policy for ${table}`, 'IZAKHONO_RELATION_POLICY_REQUIRED')
  }
  return policy
}

async function accessContext(client, project, table, userId, policy) {
  if (policy.mode !== 'scope') return { memberships: new Map(), grants: new Map() }
  const [memberships, grants] = await Promise.all([
    client.query('SELECT scope_id,role FROM iz_core_memberships WHERE project_id=$1 AND user_id=$2 AND active=true', [project, userId]),
    client.query('SELECT row_id,can_read,can_write FROM iz_core_row_grants WHERE project_id=$1 AND table_name=$2 AND user_id=$3', [project, table, userId]),
  ])
  const membershipMap = new Map()
  for (const row of memberships.rows) {
    if (!membershipMap.has(row.scope_id)) membershipMap.set(row.scope_id, new Set())
    membershipMap.get(row.scope_id).add(row.role)
  }
  return { memberships: membershipMap, grants: new Map(grants.rows.map(row => [row.row_id, row])) }
}

function valueForRow(row, field) {
  return field === 'id' ? row.row_id : row.data?.[field]
}

function canRead(row, user, policy, ctx) {
  if (policy.mode === 'project') return true
  if (policy.mode === 'owner') return row.created_by === user.id
  const scope = policy.scope_field ? valueForRow(row, policy.scope_field) : null
  const roles = scope == null ? null : ctx.memberships.get(String(scope))
  const roleAllowed = Boolean(roles && (policy.read_roles || []).some(role => roles.has(role)))
  const grant = ctx.grants.get(row.row_id)
  return roleAllowed || Boolean(grant?.can_read || grant?.can_write)
}

function projectRow(row, fields) {
  if (!fields) return { ...(row.data || {}), id: row.row_id }
  const out = {}
  for (const field of fields) {
    if (field === 'id') out.id = row.row_id
    else if (Object.prototype.hasOwnProperty.call(row.data || {}, field)) out[field] = row.data[field]
  }
  if (!Object.prototype.hasOwnProperty.call(out, 'id')) out.id = row.row_id
  return out
}

function matchesFilters(row, filters) {
  return filters.every(({ field, expected }) => {
    const actual = valueForRow(row, field)
    if (expected == null) return actual == null
    return String(actual ?? '') === expected
  })
}

function compareRows(a, b, order) {
  const av = valueForRow(a, order.field)
  const bv = valueForRow(b, order.field)
  const cmp = String(av ?? '').localeCompare(String(bv ?? ''))
  return order.direction === 'asc' ? cmp : -cmp
}

async function readableRows(client, project, table, user, policy) {
  const ctx = await accessContext(client, project, table, user.id, policy)
  const result = await client.query(
    `SELECT row_id,data,created_by,updated_at
     FROM iz_core_rows WHERE project_id=$1 AND table_name=$2
     ORDER BY updated_at DESC LIMIT 5000`,
    [project, table],
  )
  return result.rows.filter(row => canRead(row, user, policy, ctx))
}

async function relationalRead(req, res, project) {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed')
  const user = await requireUser(req, project)
  const body = await readJson(req)
  const from = validateTable(body.from)
  const fields = normalizeFields(body.fields, 'fields')
  const filters = normalizeFilters(body.filters)
  const order = normalizeOrder(body.order)
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(body.limit ?? '100'), 10) || 100))
  const offset = Math.min(100000, Math.max(0, Number.parseInt(String(body.offset ?? '0'), 10) || 0))
  if (!Array.isArray(body.relations)) body.relations = []
  if (body.relations.length > 4) throw httpError(400, 'relations supports at most 4 one-level relations')
  const relations = body.relations.map(normalizeRelation)
  if (new Set(relations.map(r => r.as)).size !== relations.length) throw httpError(400, 'relation aliases must be unique')

  const client = await pool.connect()
  try {
    const rootPolicy = await policyFor(client, project, from)
    let roots = await readableRows(client, project, from, user, rootPolicy)
    roots = roots.filter(row => matchesFilters(row, filters))
    if (order) roots.sort((a, b) => compareRows(a, b, order))
    roots = roots.slice(offset, offset + limit)

    const relationData = []
    for (const relation of relations) {
      const policy = await policyFor(client, project, relation.table)
      const rows = await readableRows(client, project, relation.table, user, policy)
      const index = new Map()
      for (const row of rows) {
        const key = valueForRow(row, relation.foreignField)
        if (key == null) continue
        const normalized = String(key)
        if (!index.has(normalized)) index.set(normalized, [])
        index.get(normalized).push(row)
      }
      relationData.push({ relation, index })
    }

    const data = roots.map(root => {
      const out = projectRow(root, fields)
      for (const { relation, index } of relationData) {
        const local = valueForRow(root, relation.localField)
        const matches = local == null ? [] : (index.get(String(local)) || [])
        if (relation.cardinality === 'one') out[relation.as] = matches.length ? projectRow(matches[0], relation.fields) : null
        else out[relation.as] = matches.slice(0, 200).map(row => projectRow(row, relation.fields))
      }
      return out
    })

    await audit(project, user.id, 'relational_read', {
      from,
      relations: relations.map(r => ({ as: r.as, table: r.table, cardinality: r.cardinality })),
      result_count: data.length,
    })
    return sendJson(req, res, 200, { data, count: data.length, limit, offset })
  } finally {
    client.release()
  }
}

export async function handleRelationRequest(req, res) {
  const rawUrl = req.url || '/'
  if (!rawUrl.startsWith('/v3/relations/')) return false
  assertOrigin(req)
  const url = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/v3/relations/capabilities') {
    sendJson(req, res, 200, {
      service: 'IZAKHONO Core Relational Reads',
      version: RELATION_VERSION,
      capabilities: {
        policyAwareRelationalRead: true,
        oneLevelRelations: true,
        maxRelations: 4,
        maxRows: 200,
        nestedPolicyEnforcement: true,
        arbitrarySql: false,
        mutations: false,
      },
    })
    return true
  }

  const match = url.pathname.match(/^\/v3\/relations\/([^/]+)\/read$/)
  if (match) {
    const project = validateProject(decodeURIComponent(match[1]))
    await relationalRead(req, res, project)
    return true
  }

  throw httpError(404, 'Not found')
}

export async function closeRelationRuntime() {
  await pool.end()
}
