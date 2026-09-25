import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'

const port = Number(process.env.IZ_CORE_ALLEGRO_TEST_PORT || 18793)
const base = `http://127.0.0.1:${port}`
const adminToken = 'ci-allegro-admin-token-0123456789-abcdefghijklmnopqrstuvwxyz'
const jwtSecret = 'ci-allegro-jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const project = `allegro-commerce-ci-${Date.now()}`
const projectKey = 'pk_allegro_ci_0123456789_abcdefghijklmnopqrstuvwxyz'

const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    IZAKHONO_CORE_ADMIN_TOKEN: adminToken,
    IZAKHONO_CORE_JWT_SECRET: jwtSecret,
    IZAKHONO_CORE_STORAGE_DIR: `/tmp/izakhono-allegro-commerce-${process.pid}`,
    IZAKHONO_CORE_ALLOWED_ORIGINS: 'https://example.test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr.on('data', chunk => { stderr += chunk })

async function call(path, { method='GET', token, key=projectKey, body } = {}) {
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
  for (let i=0;i<80;i+=1) {
    try {
      const response = await fetch(`${base}/healthz`)
      if (response.ok) return
    } catch {}
    if (child.exitCode !== null) throw new Error(`Core exited early: ${child.exitCode}\n${stderr}`)
    await sleep(250)
  }
  throw new Error(`Core health timeout\n${stderr}`)
}

async function signup(email) {
  const result = await call(`/v1/auth/${project}/signup`, {
    method:'POST',
    body:{email,password:'Allegro-Commerce-Strong-123!'},
  })
  assert.equal(result.response.status,201,JSON.stringify(result.data))
  return result.data
}

try {
  await waitHealthy()

  let result = await call('/v1/admin/projects',{
    method:'POST',
    key:null,
    token:adminToken,
    body:{
      project,
      public_key:projectKey,
      allow_signup:true,
      table_policies:{
        merch_products:'owner_public_read',
        merch_orders:'owner_action_only',
        merch_order_items:'owner_action_only',
      },
    },
  })
  assert.equal(result.response.status,201,JSON.stringify(result.data))

  const seller=await signup('seller@allegro.example.test')
  const buyer=await signup('buyer@allegro.example.test')

  result=await call(`/v1/data/${project}/merch_products`,{
    method:'POST',
    token:seller.access_token,
    body:{data:{
      id:'product-1',
      seller_id:seller.user.id,
      owner_kind:'creator',
      title:'Synthetic Creator Tee',
      description:'Synthetic commerce test item',
      product_type:'tshirt',
      price:250,
      currency:'ZAR',
      sizes:['M','L'],
      colours:['Black'],
      stock_quantity:10,
      made_to_order:false,
      active:true,
    }},
  })
  assert.equal(result.response.status,201,JSON.stringify(result.data))

  result=await call(`/v1/data/${project}/merch_products?active=true&limit=10`)
  assert.equal(result.response.status,200,JSON.stringify(result.data))
  assert.equal(result.data.length,1)
  assert.equal(result.data[0].id,'product-1')

  result=await call(`/v1/data/${project}/merch_products/product-1`,{
    method:'PATCH',
    token:buyer.access_token,
    body:{data:{title:'Attempted takeover'}},
  })
  assert.equal(result.response.status,404)

  result=await call(`/v1/data/${project}/merch_orders`,{
    method:'POST',
    token:buyer.access_token,
    body:{data:{id:'forged-order',subtotal:1,platform_fee_amount:0}},
  })
  assert.equal(result.response.status,403)

  result=await call(`/v2/data/${project}/merch_orders`,{
    method:'POST',
    token:buyer.access_token,
    body:{data:{id:'forged-order-v2',subtotal:1,platform_fee_amount:0}},
  })
  assert.equal(result.response.status,403)

  result=await call(`/v3/actions/${project}/allegro-create-merch-order`,{
    method:'POST',
    token:buyer.access_token,
    body:{product_id:'product-1',quantity:2,size:'L',colour:'Black'},
  })
  assert.equal(result.response.status,200,JSON.stringify(result.data))
  assert.equal(result.data.subtotal,500)
  assert.equal(result.data.platform_fee_amount,50)
  assert.equal(result.data.seller_net_amount,450)
  const orderId=result.data.order_id

  result=await call(`/v1/data/${project}/merch_orders`,{token:buyer.access_token})
  assert.equal(result.response.status,200,JSON.stringify(result.data))
  assert.equal(result.data.length,1)
  assert.equal(result.data[0].id,orderId)
  assert.equal(result.data[0].platform_fee_percent,10)
  assert.equal(result.data[0].platform_fee_amount,50)
  assert.equal(result.data[0].seller_net_amount,450)
  assert.equal(result.data[0].status,'payment_pending')

  result=await call(`/v3/actions/${project}/allegro-create-merch-order`,{
    method:'POST',
    token:buyer.access_token,
    body:{product_id:'product-1',quantity:1,size:'XXL',colour:'Black'},
  })
  assert.equal(result.response.status,400)

  console.log('PASS IZAKHONO Core ALLEGRO commerce E2E')
  console.log('  ✓ owner_public_read exposes approved catalogue rows without a user token')
  console.log('  ✓ product writes remain owner-restricted')
  console.log('  ✓ owner_action_only blocks forged direct order inserts on v1 and v2')
  console.log('  ✓ trusted ALLEGRO order action enforces 10% creator marketplace fee server-side')
  console.log('  ✓ invalid product options fail closed')
} finally {
  if (child.exitCode===null) {
    child.kill('SIGTERM')
    await Promise.race([once(child,'exit'),sleep(5000)])
    if (child.exitCode===null) child.kill('SIGKILL')
  }
  if (child.exitCode && child.exitCode!==0) console.error(stderr)
}
