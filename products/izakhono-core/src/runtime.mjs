import http from 'node:http'
import { createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import pg from 'pg'
import { WebSocketServer } from 'ws'

const { Pool } = pg
const scryptAsync = promisify(scrypt)

const VERSION = '0.1.0'
const PORT = Number.parseInt(process.env.PORT || '8787', 10)
const JWT_SECRET = process.env.IZAKHONO_CORE_JWT_SECRET || ''
const ADMIN_TOKEN = process.env.IZAKHONO_CORE_ADMIN_TOKEN || ''
const STORAGE_DIR = resolve(process.env.IZAKHONO_CORE_STORAGE_DIR || '/data/storage')
const ACCESS_TTL_SECONDS = Number.parseInt(process.env.IZAKHONO_CORE_ACCESS_TTL_SECONDS || '900', 10)
const REFRESH_TTL_SECONDS = Number.parseInt(process.env.IZAKHONO_CORE_REFRESH_TTL_SECONDS || String(30 * 24 * 60 * 60), 10)
const MAX_JSON_BYTES = Number.parseInt(process.env.IZAKHONO_CORE_MAX_JSON_BYTES || String(1024 * 1024), 10)
const MAX_STORAGE_BYTES = Number.parseInt(process.env.IZAKHONO_CORE_MAX_STORAGE_BYTES || String(10 * 1024 * 1024), 10)
const TRUST_PROXY = process.env.IZAKHONO_CORE_TRUST_PROXY === 'true'
const ALLOWED_ORIGINS = new Set((process.env.IZAKHONO_CORE_ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean))

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT is invalid')
if (JWT_SECRET.length < 32) throw new Error('IZAKHONO_CORE_JWT_SECRET must be at least 32 characters')
if (ADMIN_TOKEN.length < 32) throw new Error('IZAKHONO_CORE_ADMIN_TOKEN must be at least 32 characters')
if (!Number.isInteger(ACCESS_TTL_SECONDS) || ACCESS_TTL_SECONDS < 60) throw new Error('Access token TTL is invalid')
if (!Number.isInteger(REFRESH_TTL_SECONDS) || REFRESH_TTL_SECONDS < 600) throw new Error('Refresh token TTL is invalid')

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : new Pool()
const schema = await readFile(new URL('../sql/001_core.sql', import.meta.url), 'utf8')
await pool.query(schema)
await mkdir(STORAGE_DIR, { recursive: true })

const loginFailures = new Map()
const wss = new WebSocketServer({ noServer: true })

function jsonHeaders(req) {
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
  return headers
}

function corsAllowed(req) {
  const origin = req.headers.origin
  return !origin || ALLOWED_ORIGINS.has(origin) || ALLOWED_ORIGINS.has('*')
}

function sendJson(req, res, status, data) {
  res.writeHead(status, jsonHeaders(req))
  res.end(JSON.stringify(data))
}

function sendError(req, res, status, message, detail) {
  sendJson(req, res, status, { error: message, ...(detail ? { detail } : {}) })
}

async function readBody(req, limit = MAX_JSON_BYTES) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > limit) {
      const error = new Error('Request body too large')
      error.status = 413
      throw error
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readJson(req) {
  const raw = await readBody(req)
  if (!raw.length) return {}
  try {
    return JSON.parse(raw.toString('utf8'))
  } catch {
    const error = new Error('Invalid JSON body')
    error.status = 400
    throw error
  }
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function signAccessToken(user) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64urlJson({ alg: 'HS256', typ: 'JWT' })
  const payload = base64urlJson({
    iss: 'izakhono-core',
    aud: user.project_id,
    sub: user.id,
    email: user.email,
    project: user.project_id,
    iat: now,
    exp: now + ACCESS_TTL_SECONDS,
  })
  const input = `${header}.${payload}`
  const signature = createHmac('sha256', JWT_SECRET).update(input).digest('base64url')
  return `${input}.${signature}`
}

function verifyAccessToken(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) throw Object.assign(new Error('Invalid access token'), { status: 401 })
  const [headerPart, payloadPart, signature] = parts
  const expected = createHmac('sha256', JWT_SECRET).update(`${headerPart}.${payloadPart}`).digest('base64url')
  if (!safeEqual(signature, expected)) throw Object.assign(new Error('Invalid access token'), { status: 401 })
  let header
  let payload
  try {
    header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'))
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
  } catch {
    throw Object.assign(new Error('Invalid access token'), { status: 401 })
  }
  const now = Math.floor(Date.now() / 1000)
  if (header.alg !== 'HS256' || payload.iss !== 'izakhono-core' || !payload.sub || !payload.project || payload.exp <= now) {
    throw Object.assign(new Error('Expired or invalid access token'), { status: 401 })
  }
  return payload
}

async function hashPassword(password, salt = randomBytes(16).toString('base64url')) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 256) {
    throw Object.assign(new Error('Password must contain 10-256 characters'), { status: 400 })
  }
  const derived = await scryptAsync(password, salt, 64)
  return { salt, hash: Buffer.from(derived).toString('base64url') }
}

async function passwordMatches(password, salt, expectedHash) {
  const derived = await scryptAsync(password, salt, 64)
  return safeEqual(Buffer.from(derived).toString('base64url'), expectedHash)
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw Object.assign(new Error('Valid email required'), { status: 400 })
  }
  return email
}

function validateProjectId(value) {
  const project = String(value || '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project) || project.length > 64) {
    throw Object.assign(new Error('Invalid project id'), { status: 400 })
  }
  return project
}

function validateTable(value) {
  const table = String(value || '')
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(table)) {
    throw Object.assign(new Error('Invalid table name'), { status: 400 })
  }
  return table
}

function validateRowId(value) {
  const id = String(value || '')
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(id)) {
    throw Object.assign(new Error('Invalid row id'), { status: 400 })
  }
  return id
}

function validateFilterKey(value) {
  const key = String(value || '')
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(key)) {
    throw Object.assign(new Error('Invalid filter key'), { status: 400 })
  }
  return key
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    if (forwarded) return forwarded
  }
  return req.socket.remoteAddress || 'unknown'
}

function authHeaderToken(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

async function projectForKey(project, key) {
  if (!key) throw Object.assign(new Error('Project key required'), { status: 401 })
  const result = await pool.query('SELECT id, allow_signup FROM iz_core_projects WHERE id=$1 AND public_key_hash=$2', [project, sha256(key)])
  if (!result.rowCount) throw Object.assign(new Error('Invalid project key'), { status: 401 })
  return result.rows[0]
}

async function requireProject(req, project) {
  return projectForKey(project, String(req.headers['x-project-key'] || ''))
}

async function requireUser(req, project) {
  await requireProject(req, project)
  const payload = verifyAccessToken(authHeaderToken(req))
  if (payload.project !== project || payload.aud !== project) throw Object.assign(new Error('Token project mismatch'), { status: 403 })
  const result = await pool.query('SELECT id, project_id, email, user_metadata, disabled FROM iz_core_users WHERE id=$1 AND project_id=$2', [payload.sub, project])
  const user = result.rows[0]
  if (!user || user.disabled) throw Object.assign(new Error('User is unavailable'), { status: 401 })
  return user
}

function publicUser(user) {
  return { id: user.id, email: user.email, user_metadata: user.user_metadata || {} }
}

async function issueSession(user, client = pool) {
  const refreshToken = randomBytes(32).toString('base64url')
  const tokenHash = sha256(refreshToken)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000)
  await client.query(
    'INSERT INTO iz_core_refresh_tokens(token_hash, project_id, user_id, expires_at) VALUES($1,$2,$3,$4)',
    [tokenHash, user.project_id, user.id, expiresAt],
  )
  return {
    access_token: signAccessToken(user),
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: ACCESS_TTL_SECONDS,
    user: publicUser(user),
  }
}

async function audit(projectId, userId, eventType, detail = {}) {
  try {
    await pool.query(
      'INSERT INTO iz_core_audit(id, project_id, user_id, event_type, detail) VALUES($1,$2,$3,$4,$5::jsonb)',
      [randomUUID(), projectId || null, userId || null, eventType, JSON.stringify(detail)],
    )
  } catch (error) {
    console.error('audit failure', error?.message || error)
  }
}

function failureKey(req, project, email) {
  return `${clientIp(req)}|${project}|${email}`
}

function assertLoginAllowed(req, project, email) {
  const key = failureKey(req, project, email)
  const entry = loginFailures.get(key)
  if (!entry) return
  if (entry.resetAt <= Date.now()) {
    loginFailures.delete(key)
    return
  }
  if (entry.count >= 5) throw Object.assign(new Error('Too many sign-in attempts. Try again later.'), { status: 429 })
}

function recordLoginFailure(req, project, email) {
  const key = failureKey(req, project, email)
  const now = Date.now()
  const current = loginFailures.get(key)
  if (!current || current.resetAt <= now) loginFailures.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 })
  else current.count += 1
}

function clearLoginFailures(req, project, email) {
  loginFailures.delete(failureKey(req, project, email))
}

async function tablePolicy(project, table) {
  const result = await pool.query('SELECT mode FROM iz_core_table_policies WHERE project_id=$1 AND table_name=$2', [project, table])
  return result.rows[0]?.mode || 'owner'
}

function rowToJson(row) {
  return { ...(row.data || {}), id: row.row_id }
}

function broadcast(project, mode, actorUserId, payload) {
  const body = JSON.stringify(payload)
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN) continue
    const context = ws.izakhonoContext
    if (!context || context.project !== project) continue
    if (mode === 'owner' && context.userId !== actorUserId) continue
    ws.send(body)
  }
}

function safeStoragePath(project, bucket, objectPath) {
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(bucket)) throw Object.assign(new Error('Invalid storage bucket'), { status: 400 })
  if (!objectPath || objectPath.length > 512 || objectPath.includes('\\') || objectPath.includes('\0')) {
    throw Object.assign(new Error('Invalid storage path'), { status: 400 })
  }
  const parts = objectPath.split('/')
  if (parts.some(part => !part || part === '.' || part === '..')) throw Object.assign(new Error('Invalid storage path'), { status: 400 })
  const root = resolve(STORAGE_DIR, project, bucket)
  const full = resolve(root, ...parts)
  if (full !== root && !full.startsWith(`${root}${sep}`)) throw Object.assign(new Error('Invalid storage path'), { status: 400 })
  return full
}

async function handleAdminProject(req, res) {
  if (!safeEqual(authHeaderToken(req), ADMIN_TOKEN)) return sendError(req, res, 401, 'Invalid admin token')
  const body = await readJson(req)
  const project = validateProjectId(body.project)
  const rotate = body.rotate === true
  const allowSignup = body.allow_signup === true
  const suppliedKey = body.public_key ? String(body.public_key) : ''
  const publicKey = suppliedKey || randomBytes(24).toString('base64url')
  if (publicKey.length < 20 || publicKey.length > 200) return sendError(req, res, 400, 'public_key must contain 20-200 characters')

  const existing = await pool.query('SELECT id FROM iz_core_projects WHERE id=$1', [project])
  if (existing.rowCount && !rotate) return sendError(req, res, 409, 'Project already exists; set rotate=true explicitly to rotate its public key')

  await pool.query(
    `INSERT INTO iz_core_projects(id, public_key_hash, allow_signup)
     VALUES($1,$2,$3)
     ON CONFLICT(id) DO UPDATE SET public_key_hash=EXCLUDED.public_key_hash, allow_signup=EXCLUDED.allow_signup, updated_at=now()`,
    [project, sha256(publicKey), allowSignup],
  )

  const policies = body.table_policies && typeof body.table_policies === 'object' ? body.table_policies : {}
  for (const [tableRaw, modeRaw] of Object.entries(policies)) {
    const table = validateTable(tableRaw)
    const mode = String(modeRaw)
    if (!['owner', 'project'].includes(mode)) return sendError(req, res, 400, `Invalid table policy for ${table}`)
    await pool.query(
      `INSERT INTO iz_core_table_policies(project_id, table_name, mode) VALUES($1,$2,$3)
       ON CONFLICT(project_id, table_name) DO UPDATE SET mode=EXCLUDED.mode, updated_at=now()`,
      [project, table, mode],
    )
  }

  await audit(project, null, existing.rowCount ? 'project.rotated' : 'project.created', { allow_signup: allowSignup, policies: Object.keys(policies) })
  return sendJson(req, res, existing.rowCount ? 200 : 201, { project, public_key: publicKey, allow_signup: allowSignup })
}

async function handleSignup(req, res, project) {
  const projectRow = await requireProject(req, project)
  if (!projectRow.allow_signup) return sendError(req, res, 403, 'Signup is disabled for this project')
  const body = await readJson(req)
  const email = normalizeEmail(body.email)
  const { salt, hash } = await hashPassword(body.password)
  const metadata = body.user_metadata && typeof body.user_metadata === 'object' && !Array.isArray(body.user_metadata) ? body.user_metadata : {}
  const id = randomUUID()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const inserted = await client.query(
      `INSERT INTO iz_core_users(id, project_id, email, password_salt, password_hash, user_metadata)
       VALUES($1,$2,$3,$4,$5,$6::jsonb)
       RETURNING id, project_id, email, user_metadata`,
      [id, project, email, salt, hash, JSON.stringify(metadata)],
    )
    const session = await issueSession(inserted.rows[0], client)
    await client.query('COMMIT')
    await audit(project, id, 'auth.signup', {})
    return sendJson(req, res, 201, session)
  } catch (error) {
    await client.query('ROLLBACK')
    if (error?.code === '23505') return sendError(req, res, 409, 'Account already exists')
    throw error
  } finally {
    client.release()
  }
}

async function handleSignin(req, res, project) {
  await requireProject(req, project)
  const body = await readJson(req)
  const email = normalizeEmail(body.email)
  assertLoginAllowed(req, project, email)
  const result = await pool.query(
    'SELECT id, project_id, email, password_salt, password_hash, user_metadata, disabled FROM iz_core_users WHERE project_id=$1 AND email=$2',
    [project, email],
  )
  const user = result.rows[0]
  if (!user || user.disabled || !(await passwordMatches(String(body.password || ''), user.password_salt || '', user.password_hash || ''))) {
    recordLoginFailure(req, project, email)
    await audit(project, user?.id || null, 'auth.signin_failed', { ip: clientIp(req) })
    return sendError(req, res, 401, 'Invalid email or password')
  }
  clearLoginFailures(req, project, email)
  const session = await issueSession(user)
  await audit(project, user.id, 'auth.signin', { ip: clientIp(req) })
  return sendJson(req, res, 200, session)
}

async function handleRefresh(req, res, project) {
  await requireProject(req, project)
  const body = await readJson(req)
  const refreshToken = String(body.refresh_token || '')
  if (!refreshToken) return sendError(req, res, 400, 'refresh_token required')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `SELECT r.token_hash, r.user_id, u.project_id, u.email, u.user_metadata, u.disabled
       FROM iz_core_refresh_tokens r
       JOIN iz_core_users u ON u.id=r.user_id
       WHERE r.token_hash=$1 AND r.project_id=$2 AND r.revoked_at IS NULL AND r.expires_at > now()
       FOR UPDATE`,
      [sha256(refreshToken), project],
    )
    const row = result.rows[0]
    if (!row || row.disabled) {
      await client.query('ROLLBACK')
      return sendError(req, res, 401, 'Invalid refresh token')
    }
    await client.query('UPDATE iz_core_refresh_tokens SET revoked_at=now() WHERE token_hash=$1', [row.token_hash])
    const user = { id: row.user_id, project_id: row.project_id, email: row.email, user_metadata: row.user_metadata }
    const session = await issueSession(user, client)
    await client.query('COMMIT')
    await audit(project, row.user_id, 'auth.refresh', {})
    return sendJson(req, res, 200, session)
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    throw error
  } finally {
    client.release()
  }
}

async function handleSignout(req, res, project) {
  const user = await requireUser(req, project)
  const body = await readJson(req)
  if (body.refresh_token) {
    await pool.query(
      'UPDATE iz_core_refresh_tokens SET revoked_at=COALESCE(revoked_at, now()) WHERE token_hash=$1 AND project_id=$2 AND user_id=$3',
      [sha256(String(body.refresh_token)), project, user.id],
    )
  }
  await audit(project, user.id, 'auth.signout', {})
  return sendJson(req, res, 200, { ok: true })
}

async function handleMe(req, res, project) {
  const user = await requireUser(req, project)
  return sendJson(req, res, 200, publicUser(user))
}

async function handleDataCollection(req, res, url, project, table) {
  const user = await requireUser(req, project)
  const mode = await tablePolicy(project, table)
  if (req.method === 'GET') {
    const values = [project, table]
    const clauses = ['project_id=$1', 'table_name=$2']
    if (mode === 'owner') {
      values.push(user.id)
      clauses.push(`created_by=$${values.length}`)
    }
    for (const [rawKey, value] of url.searchParams.entries()) {
      if (['order', 'limit', 'offset'].includes(rawKey)) continue
      const key = validateFilterKey(rawKey)
      values.push(key)
      const keyParam = values.length
      values.push(String(value))
      clauses.push(`data ->> $${keyParam} = $${values.length}`)
    }
    let orderSql = 'updated_at DESC'
    const order = url.searchParams.get('order')
    if (order) {
      const match = order.match(/^([A-Za-z_][A-Za-z0-9_]{0,62})\.(asc|desc)$/)
      if (!match) return sendError(req, res, 400, 'Invalid order expression')
      const [, key, direction] = match
      orderSql = key === 'id' ? `row_id ${direction.toUpperCase()}` : `(data ->> '${key}') ${direction.toUpperCase()}`
    }
    const limit = Math.min(200, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '100', 10) || 100))
    const offset = Math.min(100000, Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0))
    values.push(limit)
    const limitParam = values.length
    values.push(offset)
    const offsetParam = values.length
    const result = await pool.query(
      `SELECT row_id, data FROM iz_core_rows WHERE ${clauses.join(' AND ')} ORDER BY ${orderSql} LIMIT $${limitParam} OFFSET $${offsetParam}`,
      values,
    )
    return sendJson(req, res, 200, result.rows.map(rowToJson))
  }

  if (req.method === 'POST') {
    const body = await readJson(req)
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return sendError(req, res, 400, 'data object required')
    const payload = { ...body.data }
    const id = payload.id ? validateRowId(payload.id) : randomUUID()
    delete payload.id
    try {
      const result = await pool.query(
        `INSERT INTO iz_core_rows(project_id, table_name, row_id, data, created_by)
         VALUES($1,$2,$3,$4::jsonb,$5)
         RETURNING row_id, data`,
        [project, table, id, JSON.stringify(payload), user.id],
      )
      const row = rowToJson(result.rows[0])
      await audit(project, user.id, 'data.insert', { table, id })
      broadcast(project, mode, user.id, { type: 'row.changed', event: 'INSERT', table, row })
      return sendJson(req, res, 201, row)
    } catch (error) {
      if (error?.code === '23505') return sendError(req, res, 409, 'Row already exists')
      throw error
    }
  }

  return sendError(req, res, 405, 'Method not allowed')
}

async function handleDataRow(req, res, project, table, id) {
  const user = await requireUser(req, project)
  const mode = await tablePolicy(project, table)
  const ownerClause = mode === 'owner' ? ' AND created_by=$4' : ''
  const baseValues = [project, table, id]

  if (req.method === 'PATCH') {
    const body = await readJson(req)
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return sendError(req, res, 400, 'data object required')
    const payload = { ...body.data }
    delete payload.id
    const values = [...baseValues, ...(mode === 'owner' ? [user.id] : []), JSON.stringify(payload)]
    const jsonParam = values.length
    const result = await pool.query(
      `UPDATE iz_core_rows SET data=data || $${jsonParam}::jsonb, updated_at=now()
       WHERE project_id=$1 AND table_name=$2 AND row_id=$3${ownerClause}
       RETURNING row_id, data`,
      values,
    )
    if (!result.rowCount) return sendError(req, res, 404, 'Row not found')
    const row = rowToJson(result.rows[0])
    await audit(project, user.id, 'data.update', { table, id })
    broadcast(project, mode, user.id, { type: 'row.changed', event: 'UPDATE', table, row })
    return sendJson(req, res, 200, row)
  }

  if (req.method === 'DELETE') {
    const values = [...baseValues, ...(mode === 'owner' ? [user.id] : [])]
    const result = await pool.query(
      `DELETE FROM iz_core_rows WHERE project_id=$1 AND table_name=$2 AND row_id=$3${ownerClause} RETURNING row_id, data`,
      values,
    )
    if (!result.rowCount) return sendError(req, res, 404, 'Row not found')
    const row = rowToJson(result.rows[0])
    await audit(project, user.id, 'data.delete', { table, id })
    broadcast(project, mode, user.id, { type: 'row.changed', event: 'DELETE', table, row })
    return sendJson(req, res, 200, row)
  }

  return sendError(req, res, 405, 'Method not allowed')
}

async function handleStorage(req, res, project, bucket, objectPath) {
  const user = await requireUser(req, project)
  const filePath = safeStoragePath(project, bucket, objectPath)

  if (req.method === 'PUT') {
    const existing = await pool.query(
      'SELECT created_by FROM iz_core_storage_objects WHERE project_id=$1 AND bucket=$2 AND object_path=$3',
      [project, bucket, objectPath],
    )
    if (existing.rowCount && existing.rows[0].created_by !== user.id) return sendError(req, res, 403, 'Storage object belongs to another user')
    const content = await readBody(req, MAX_STORAGE_BYTES)
    const digest = sha256(content)
    const contentType = String(req.headers['content-type'] || 'application/octet-stream').slice(0, 200)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, { mode: 0o600 })
    await pool.query(
      `INSERT INTO iz_core_storage_objects(project_id,bucket,object_path,created_by,content_type,byte_size,sha256)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(project_id,bucket,object_path)
       DO UPDATE SET content_type=EXCLUDED.content_type, byte_size=EXCLUDED.byte_size, sha256=EXCLUDED.sha256, updated_at=now()`,
      [project, bucket, objectPath, user.id, contentType, content.length, digest],
    )
    await audit(project, user.id, 'storage.put', { bucket, objectPath, bytes: content.length })
    return sendJson(req, res, 201, { bucket, path: objectPath, size: content.length, sha256: digest })
  }

  if (req.method === 'GET') {
    const result = await pool.query(
      `SELECT content_type, byte_size, sha256 FROM iz_core_storage_objects
       WHERE project_id=$1 AND bucket=$2 AND object_path=$3 AND created_by=$4`,
      [project, bucket, objectPath, user.id],
    )
    if (!result.rowCount) return sendError(req, res, 404, 'Storage object not found')
    let content
    try { content = await readFile(filePath) } catch { return sendError(req, res, 404, 'Storage object file missing') }
    const metadata = result.rows[0]
    res.writeHead(200, {
      'content-type': metadata.content_type,
      'content-length': String(content.length),
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'x-izakhono-sha256': metadata.sha256,
    })
    return res.end(content)
  }

  if (req.method === 'DELETE') {
    const result = await pool.query(
      `DELETE FROM iz_core_storage_objects
       WHERE project_id=$1 AND bucket=$2 AND object_path=$3 AND created_by=$4
       RETURNING object_path`,
      [project, bucket, objectPath, user.id],
    )
    if (!result.rowCount) return sendError(req, res, 404, 'Storage object not found')
    try { await unlink(filePath) } catch {}
    await audit(project, user.id, 'storage.delete', { bucket, objectPath })
    return sendJson(req, res, 200, { ok: true })
  }

  return sendError(req, res, 405, 'Method not allowed')
}

const server = http.createServer(async (req, res) => {
  try {
    if (!corsAllowed(req)) return sendError(req, res, 403, 'Origin not allowed')
    if (req.method === 'OPTIONS') {
      const headers = jsonHeaders(req)
      headers['access-control-allow-methods'] = 'GET,POST,PATCH,PUT,DELETE,OPTIONS'
      headers['access-control-allow-headers'] = 'Authorization,Content-Type,X-Project-Key'
      headers['access-control-max-age'] = '600'
      res.writeHead(204, headers)
      return res.end()
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'GET' && url.pathname === '/healthz') {
      try {
        await pool.query('SELECT 1')
        return sendJson(req, res, 200, { ok: true, service: 'IZAKHONO Core', version: VERSION, storage: 'local-volume', database: 'postgresql' })
      } catch {
        return sendJson(req, res, 503, { ok: false, service: 'IZAKHONO Core', version: VERSION })
      }
    }

    if (req.method === 'GET' && url.pathname === '/v1/capabilities') {
      return sendJson(req, res, 200, {
        service: 'IZAKHONO Core',
        version: VERSION,
        capabilities: {
          passwordAuth: true,
          refreshTokens: true,
          projectIsolation: true,
          ownerDefaultDataPolicy: true,
          projectSharedDataPolicy: true,
          basicCrud: true,
          storage: true,
          realtime: true,
          relationalSelect: false,
          rpc: false,
          edgeFunctions: false,
          passwordRecovery: false,
        },
      })
    }

    if (req.method === 'POST' && url.pathname === '/v1/admin/projects') return handleAdminProject(req, res)

    let match = url.pathname.match(/^\/v1\/auth\/([^/]+)\/(signup|signin|refresh|signout|me)$/)
    if (match) {
      const project = validateProjectId(decodeURIComponent(match[1]))
      const action = match[2]
      if (action === 'signup' && req.method === 'POST') return handleSignup(req, res, project)
      if (action === 'signin' && req.method === 'POST') return handleSignin(req, res, project)
      if (action === 'refresh' && req.method === 'POST') return handleRefresh(req, res, project)
      if (action === 'signout' && req.method === 'POST') return handleSignout(req, res, project)
      if (action === 'me' && req.method === 'GET') return handleMe(req, res, project)
      return sendError(req, res, 405, 'Method not allowed')
    }

    match = url.pathname.match(/^\/v1\/data\/([^/]+)\/([^/]+)$/)
    if (match) {
      const project = validateProjectId(decodeURIComponent(match[1]))
      const table = validateTable(decodeURIComponent(match[2]))
      return handleDataCollection(req, res, url, project, table)
    }

    match = url.pathname.match(/^\/v1\/data\/([^/]+)\/([^/]+)\/([^/]+)$/)
    if (match) {
      const project = validateProjectId(decodeURIComponent(match[1]))
      const table = validateTable(decodeURIComponent(match[2]))
      const id = validateRowId(decodeURIComponent(match[3]))
      return handleDataRow(req, res, project, table, id)
    }

    match = url.pathname.match(/^\/v1\/storage\/([^/]+)\/([^/]+)\/(.+)$/)
    if (match) {
      const project = validateProjectId(decodeURIComponent(match[1]))
      const bucket = decodeURIComponent(match[2])
      const objectPath = decodeURIComponent(match[3])
      return handleStorage(req, res, project, bucket, objectPath)
    }

    return sendError(req, res, 404, 'Not found')
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    if (status >= 500) console.error(error)
    return sendError(req, res, status, status >= 500 ? 'Internal server error' : error.message)
  }
})

server.on('upgrade', async (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const match = url.pathname.match(/^\/v1\/realtime\/([^/]+)$/)
    if (!match) throw Object.assign(new Error('Not found'), { status: 404 })
    const project = validateProjectId(decodeURIComponent(match[1]))
    const projectKey = url.searchParams.get('project_key') || ''
    await projectForKey(project, projectKey)
    const payload = verifyAccessToken(url.searchParams.get('access_token') || '')
    if (payload.project !== project || payload.aud !== project) throw Object.assign(new Error('Token project mismatch'), { status: 403 })
    const result = await pool.query('SELECT id, disabled FROM iz_core_users WHERE id=$1 AND project_id=$2', [payload.sub, project])
    if (!result.rowCount || result.rows[0].disabled) throw Object.assign(new Error('User unavailable'), { status: 401 })
    wss.handleUpgrade(req, socket, head, ws => {
      ws.izakhonoContext = { project, userId: payload.sub }
      wss.emit('connection', ws, req)
    })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 401
    socket.write(`HTTP/1.1 ${status} Unauthorized\r\nConnection: close\r\n\r\n`)
    socket.destroy()
  }
})

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'ready', service: 'IZAKHONO Core', version: VERSION }))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`IZAKHONO Core ${VERSION} listening on :${PORT}`)
})

async function shutdown(signal) {
  console.log(`${signal}: shutting down IZAKHONO Core`)
  for (const ws of wss.clients) ws.close(1001, 'server shutdown')
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
