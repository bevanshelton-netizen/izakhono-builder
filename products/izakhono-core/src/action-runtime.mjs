import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import pg from 'pg'

const { Pool } = pg
const ACTION_VERSION = '0.2.0-actions-preview'
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

function validateRowId(value) {
  const id = String(value || '')
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(id)) throw httpError(400, 'Invalid row id')
  return id
}

function validateScope(value) {
  const scope = String(value || '')
  if (!scope || scope.length > 160 || /[\r\n\0]/.test(scope)) throw httpError(400, 'Invalid scope id')
  return scope
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
    console.error('action audit failure', error?.message || error)
  }
}

async function policyFor(client, project, table) {
  const result = await client.query(
    `SELECT mode,scope_field,write_roles
     FROM iz_core_table_policies WHERE project_id=$1 AND table_name=$2`,
    [project, table],
  )
  if (!result.rowCount) throw httpError(409, `Trusted action requires an explicit scoped policy for ${table}`, 'IZAKHONO_ACTION_SCOPE_POLICY_REQUIRED')
  const policy = result.rows[0]
  if (policy.mode !== 'scope' || !policy.scope_field || !Array.isArray(policy.write_roles) || !policy.write_roles.length) {
    throw httpError(409, `Trusted action requires a writable scope policy for ${table}`, 'IZAKHONO_ACTION_SCOPE_POLICY_REQUIRED')
  }
  return policy
}

async function rolesForScope(client, project, userId, scopeId) {
  const result = await client.query(
    'SELECT role FROM iz_core_memberships WHERE project_id=$1 AND user_id=$2 AND scope_id=$3 AND active=true',
    [project, userId, scopeId],
  )
  return new Set(result.rows.map(row => row.role))
}

function canWriteScope(actualRoles, writeRoles) {
  return writeRoles.some(role => actualRoles.has(role))
}

function normalizeOperation(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, `operations[${index}] must be an object`)
  const op = String(value.op || '').toLowerCase()
  if (!['insert', 'patch'].includes(op)) throw httpError(400, `operations[${index}].op must be insert or patch`)
  const table = validateTable(value.table)
  const data = value.data && typeof value.data === 'object' && !Array.isArray(value.data) ? { ...value.data } : null
  if (!data) throw httpError(400, `operations[${index}].data must be an object`)
  const id = value.id == null ? (op === 'insert' ? randomUUID() : null) : validateRowId(value.id)
  if (op === 'patch' && !id) throw httpError(400, `operations[${index}].id is required for patch`)
  delete data.id
  return { op, table, id, data }
}

async function atomicScopeBatch(req, res, project) {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed')
  const user = await requireUser(req, project)
  const body = await readJson(req)
  const scopeId = validateScope(body.scope_id)
  if (!Array.isArray(body.operations) || body.operations.length < 1 || body.operations.length > 20) {
    throw httpError(400, 'operations must contain between 1 and 20 operations')
  }
  const operations = body.operations.map(normalizeOperation)
  const client = await pool.connect()
  const touchedTables = new Set()
  const results = []
  try {
    await client.query('BEGIN')
    const actualRoles = await rolesForScope(client, project, user.id, scopeId)
    if (!actualRoles.size) throw httpError(403, 'No active membership for requested scope')

    const policyCache = new Map()
    for (const operation of operations) {
      let policy = policyCache.get(operation.table)
      if (!policy) {
        policy = await policyFor(client, project, operation.table)
        policyCache.set(operation.table, policy)
      }
      if (!canWriteScope(actualRoles, policy.write_roles)) throw httpError(403, `No trusted-action write access to ${operation.table}`)
      const scopeField = policy.scope_field
      touchedTables.add(operation.table)

      if (operation.op === 'insert') {
        const suppliedScope = operation.data[scopeField]
        if (suppliedScope == null) operation.data[scopeField] = scopeId
        else if (String(suppliedScope) !== scopeId) throw httpError(403, `Cannot insert ${operation.table} outside requested scope`)
        try {
          const inserted = await client.query(
            `INSERT INTO iz_core_rows(project_id,table_name,row_id,data,created_by)
             VALUES($1,$2,$3,$4::jsonb,$5) RETURNING row_id,data`,
            [project, operation.table, operation.id, JSON.stringify(operation.data), user.id],
          )
          results.push({ op: 'insert', table: operation.table, row: { ...(inserted.rows[0].data || {}), id: inserted.rows[0].row_id } })
        } catch (error) {
          if (error?.code === '23505') throw httpError(409, `Row already exists in ${operation.table}`, 'IZAKHONO_ACTION_CONFLICT')
          throw error
        }
        continue
      }

      const found = await client.query(
        `SELECT row_id,data FROM iz_core_rows
         WHERE project_id=$1 AND table_name=$2 AND row_id=$3 FOR UPDATE`,
        [project, operation.table, operation.id],
      )
      if (!found.rowCount) throw httpError(404, `Row not found in ${operation.table}`)
      const existing = found.rows[0]
      if (String(existing.data?.[scopeField] ?? '') !== scopeId) throw httpError(404, `Row not found in requested scope`)
      if (operation.data[scopeField] != null && String(operation.data[scopeField]) !== scopeId) {
        throw httpError(403, `Cannot move ${operation.table} outside requested scope`)
      }
      operation.data[scopeField] = scopeId
      const updated = await client.query(
        `UPDATE iz_core_rows SET data=data || $4::jsonb,updated_at=now()
         WHERE project_id=$1 AND table_name=$2 AND row_id=$3 RETURNING row_id,data`,
        [project, operation.table, operation.id, JSON.stringify(operation.data)],
      )
      results.push({ op: 'patch', table: operation.table, row: { ...(updated.rows[0].data || {}), id: updated.rows[0].row_id } })
    }

    await client.query('COMMIT')
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    throw error
  } finally {
    client.release()
  }

  await audit(project, user.id, 'trusted_action.atomic_scope_batch', {
    scope_id: scopeId,
    operation_count: operations.length,
    tables: [...touchedTables].sort(),
  })
  return sendJson(req, res, 200, { ok: true, action: 'atomic-scope-batch', scope_id: scopeId, results })
}

export async function handleActionRequest(req, res) {
  const rawUrl = req.url || '/'
  if (!rawUrl.startsWith('/v3/actions/')) return false
  assertOrigin(req)
  const url = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/v3/actions/capabilities') {
    sendJson(req, res, 200, {
      service: 'IZAKHONO Core Trusted Actions',
      version: ACTION_VERSION,
      capabilities: {
        trustedScopedActions: true,
        atomicScopeBatch: true,
        maxOperations: 20,
        insert: true,
        patch: true,
        delete: false,
        arbitrarySql: false,
        browserServerSecrets: false,
      },
    })
    return true
  }

  const match = url.pathname.match(/^\/v3\/actions\/([^/]+)\/atomic-scope-batch$/)
  if (match) {
    const project = validateProject(decodeURIComponent(match[1]))
    await atomicScopeBatch(req, res, project)
    return true
  }

  throw httpError(404, 'Not found')
}

export async function closeActionRuntime() {
  await pool.end()
}
