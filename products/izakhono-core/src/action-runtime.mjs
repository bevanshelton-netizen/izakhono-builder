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

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function validateMerchQuantity(value) {
  const quantity = Number(value)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw httpError(400, 'Quantity must be an integer between 1 and 100')
  return quantity
}

function normalizeOptionalChoice(value, allowed, label) {
  if (value == null || value === '') return null
  const choice = String(value)
  if (Array.isArray(allowed) && allowed.length && !allowed.map(String).includes(choice)) throw httpError(400, `${label} is not available for this product`)
  return choice
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



function normalizeMerchText(value, label, { min = 0, max = 5000 } = {}) {
  const text = String(value ?? '').trim()
  if (text.length < min || text.length > max) throw httpError(400, `${label} must contain ${min}-${max} characters`)
  return text
}

function normalizeMerchList(value, label) {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 30) throw httpError(400, `${label} must be an array with at most 30 values`)
  return [...new Set(value.map(item => normalizeMerchText(item, label, { min: 1, max: 80 })))]
}

async function requireApprovedAllegroVetting(client, project, userId) {
  const result = await client.query(
    `SELECT data FROM iz_core_rows
     WHERE project_id=$1 AND table_name='musician_vetting' AND created_by=$2
       AND data->>'status'='approved'
     ORDER BY updated_at DESC LIMIT 1`,
    [project, userId],
  )
  if (!result.rowCount) throw httpError(403, 'Approved ALLEGRO marketplace vetting is required')
  const expiresAt = result.rows[0].data?.expires_at
  if (expiresAt && Number.isFinite(Date.parse(String(expiresAt))) && Date.parse(String(expiresAt)) <= Date.now()) {
    throw httpError(403, 'ALLEGRO marketplace vetting has expired')
  }
}

async function allegroCreateMerchProduct(req, res, project) {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed')
  const user = await requireUser(req, project)
  const body = await readJson(req)
  const allowedTypes = new Set(['tshirt','hoodie','cap','jacket','poster','vinyl','cd','accessory','bundle','other'])
  const title = normalizeMerchText(body.title, 'Product name', { min: 2, max: 160 })
  const description = normalizeMerchText(body.description, 'Description', { min: 0, max: 5000 })
  const productType = String(body.product_type || 'other')
  if (!allowedTypes.has(productType)) throw httpError(400, 'Invalid product type')
  const price = Number(body.price)
  if (!Number.isFinite(price) || price < 0 || price > 10000000) throw httpError(400, 'Invalid product price')
  const currency = String(body.currency || 'ZAR').toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw httpError(400, 'Invalid currency')
  const sizes = normalizeMerchList(body.sizes, 'Sizes')
  const colours = normalizeMerchList(body.colours, 'Colours')
  let stockQuantity = null
  if (body.stock_quantity != null && body.stock_quantity !== '') {
    stockQuantity = Number(body.stock_quantity)
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1000000) throw httpError(400, 'Invalid stock quantity')
  }
  let imageUrl = null
  if (body.image_url) {
    imageUrl = normalizeMerchText(body.image_url, 'Image URL', { min: 8, max: 2048 })
    let parsed
    try { parsed = new URL(imageUrl) } catch { throw httpError(400, 'Image URL must be valid HTTPS') }
    if (parsed.protocol !== 'https:') throw httpError(400, 'Image URL must use HTTPS')
  }

  const client = await pool.connect()
  let product
  try {
    await client.query('BEGIN')
    await requireApprovedAllegroVetting(client, project, user.id)
    const id = randomUUID()
    const now = new Date().toISOString()
    const data = {
      seller_id: user.id,
      owner_kind: 'creator',
      title,
      description,
      product_type: productType,
      price: roundMoney(price),
      currency,
      image_url: imageUrl,
      sizes,
      colours,
      stock_quantity: stockQuantity,
      made_to_order: body.made_to_order === true,
      active: true,
      created_at: now,
      updated_at: now,
    }
    const inserted = await client.query(
      `INSERT INTO iz_core_rows(project_id,table_name,row_id,data,created_by)
       VALUES($1,'merch_products',$2,$3::jsonb,$4)
       RETURNING row_id,data`,
      [project, id, JSON.stringify(data), user.id],
    )
    await client.query('COMMIT')
    product = { ...(inserted.rows[0].data || {}), id: inserted.rows[0].row_id }
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    throw error
  } finally {
    client.release()
  }

  await audit(project, user.id, 'trusted_action.allegro_create_merch_product', {
    product_id: product.id,
    product_type: product.product_type,
    currency: product.currency,
    price: product.price,
  })
  return sendJson(req, res, 201, { ok: true, product })
}

async function allegroCreateMerchOrder(req, res, project) {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed')
  const user = await requireUser(req, project)
  const body = await readJson(req)
  const productId = validateRowId(body.product_id)
  const quantity = validateMerchQuantity(body.quantity)
  const client = await pool.connect()
  let response
  try {
    await client.query('BEGIN')
    const found = await client.query(
      `SELECT row_id,data,created_by FROM iz_core_rows
       WHERE project_id=$1 AND table_name='merch_products' AND row_id=$2
       FOR UPDATE`,
      [project, productId],
    )
    if (!found.rowCount) throw httpError(404, 'Product unavailable')
    const product = found.rows[0]
    const data = product.data || {}
    if (data.active !== true) throw httpError(409, 'Product unavailable')

    const price = Number(data.price)
    if (!Number.isFinite(price) || price < 0) throw httpError(409, 'Product has an invalid price')
    const stock = data.stock_quantity == null ? null : Number(data.stock_quantity)
    if (stock != null && (!Number.isInteger(stock) || stock < quantity)) throw httpError(409, 'Insufficient stock')

    const ownerKind = data.owner_kind === 'platform' ? 'platform' : 'creator'
    const sellerId = ownerKind === 'creator' ? product.created_by : null
    const size = normalizeOptionalChoice(body.size, data.sizes, 'Size')
    const colour = normalizeOptionalChoice(body.colour, data.colours, 'Colour')
    const currency = /^[A-Z]{3}$/.test(String(data.currency || 'ZAR').toUpperCase()) ? String(data.currency || 'ZAR').toUpperCase() : 'ZAR'
    const subtotal = roundMoney(price * quantity)
    const fee = ownerKind === 'creator' ? roundMoney(subtotal * 0.10) : 0
    const sellerNet = roundMoney(subtotal - fee)
    const orderId = randomUUID()
    const itemId = randomUUID()
    const now = new Date().toISOString()

    const orderData = {
      buyer_id: user.id,
      seller_id: sellerId,
      owner_kind: ownerKind,
      currency,
      subtotal,
      platform_fee_percent: 10,
      platform_fee_amount: fee,
      seller_net_amount: sellerNet,
      shipping_amount: 0,
      total_amount: subtotal,
      status: 'payment_pending',
      payment_provider: null,
      payment_reference: null,
      created_at: now,
      updated_at: now,
    }
    const itemData = {
      order_id: orderId,
      product_id: productId,
      quantity,
      unit_price: roundMoney(price),
      selected_size: size,
      selected_colour: colour,
      line_total: subtotal,
      created_at: now,
    }

    await client.query(
      `INSERT INTO iz_core_rows(project_id,table_name,row_id,data,created_by)
       VALUES($1,'merch_orders',$2,$3::jsonb,$4)`,
      [project, orderId, JSON.stringify(orderData), user.id],
    )
    await client.query(
      `INSERT INTO iz_core_rows(project_id,table_name,row_id,data,created_by)
       VALUES($1,'merch_order_items',$2,$3::jsonb,$4)`,
      [project, itemId, JSON.stringify(itemData), user.id],
    )
    await client.query('COMMIT')
    response = { ok: true, order_id: orderId, item_id: itemId, currency, subtotal, platform_fee_amount: fee, seller_net_amount: sellerNet }
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    throw error
  } finally {
    client.release()
  }

  await audit(project, user.id, 'trusted_action.allegro_create_merch_order', {
    order_id: response.order_id,
    product_id: productId,
    quantity,
    currency: response.currency,
    subtotal: response.subtotal,
    platform_fee_amount: response.platform_fee_amount,
  })
  return sendJson(req, res, 200, response)
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
        allegroCreateMerchOrder: true,
        allegroCreateMerchProduct: true,
        allegroCreatorMerchRequiresApprovedVetting: true,
        allegroCreatorMerchFeePercent: 10,
      },
    })
    return true
  }

  let match = url.pathname.match(/^\/v3\/actions\/([^/]+)\/atomic-scope-batch$/)
  if (match) {
    const project = validateProject(decodeURIComponent(match[1]))
    await atomicScopeBatch(req, res, project)
    return true
  }

  match = url.pathname.match(/^\/v3\/actions\/([^/]+)\/allegro-create-merch-product$/)
  if (match) {
    const project = validateProject(decodeURIComponent(match[1]))
    await allegroCreateMerchProduct(req, res, project)
    return true
  }

  match = url.pathname.match(/^\/v3\/actions\/([^/]+)\/allegro-create-merch-order$/)
  if (match) {
    const project = validateProject(decodeURIComponent(match[1]))
    await allegroCreateMerchOrder(req, res, project)
    return true
  }

  throw httpError(404, 'Not found')
}

export async function closeActionRuntime() {
  await pool.end()
}
