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
        musician_vetting:'owner_action_only',
        musician_ads:'owner_public_read_action_only',
        musician_ad_responses:'owner_action_only',
        merch_products:'owner_public_read_action_only',
        merch_orders:'owner_action_only',
        merch_order_items:'owner_action_only',
      },
    },
  })
  assert.equal(result.response.status,201,JSON.stringify(result.data))

  const seller=await signup('seller@allegro.example.test')
  const buyer=await signup('buyer@allegro.example.test')

  // Direct self-approval is forbidden.
  result=await call(`/v1/data/${project}/musician_vetting`,{
    method:'POST',
    token:seller.access_token,
    body:{data:{user_id:seller.user.id,status:'approved',identity_checked:true,contact_checked:true,profile_checked:true}},
  })
  assert.equal(result.response.status,403)

  // The user may only request vetting; approval stays on the protected admin route.
  result=await call(`/v3/actions/${project}/allegro-request-vetting`,{
    method:'POST',
    token:seller.access_token,
    body:{},
  })
  assert.equal(result.response.status,200,JSON.stringify(result.data))
  assert.equal(result.data.vetting.status,'pending')

  // Unapproved creators cannot publish merchandise.
  result=await call(`/v3/actions/${project}/allegro-create-merch-product`,{
    method:'POST',
    token:seller.access_token,
    body:{title:'Synthetic Creator Tee',description:'Synthetic commerce test item',product_type:'tshirt',price:250,currency:'ZAR',sizes:['M','L'],colours:['Black'],stock_quantity:10},
  })
  assert.equal(result.response.status,403)

  result=await call(`/v3/admin/actions/${project}/allegro-review-vetting`,{
    method:'POST',
    key:null,
    token:adminToken,
    body:{user_id:seller.user.id,status:'approved',identity_checked:true,contact_checked:true,profile_checked:true,references_checked:false,organisation_checked:false},
  })
  assert.equal(result.response.status,200,JSON.stringify(result.data))
  assert.equal(result.data.vetting.status,'approved')

  result=await call(`/v3/actions/${project}/allegro-create-merch-product`,{
    method:'POST',
    token:seller.access_token,
    body:{title:'Synthetic Creator Tee',description:'Synthetic commerce test item',product_type:'tshirt',price:250,currency:'ZAR',sizes:['M','L'],colours:['Black'],stock_quantity:10,made_to_order:false},
  })
  assert.equal(result.response.status,201,JSON.stringify(result.data))
  const productId=result.data.product.id
  assert.equal(result.data.product.owner_kind,'creator')
  assert.equal(result.data.product.seller_id,seller.user.id)

  // Public catalogue reads require only the browser-safe project key.
  result=await call(`/v1/data/${project}/merch_products?active=true&limit=10`)
  assert.equal(result.response.status,200,JSON.stringify(result.data))
  assert.equal(result.data.length,1)
  assert.equal(result.data[0].id,productId)

  result=await call(`/v2/data/${project}/merch_products?active=true&limit=10`)
  assert.equal(result.response.status,200,JSON.stringify(result.data))
  assert.equal(result.data.length,1)
  assert.equal(result.data[0].id,productId)

  // Even the product owner cannot bypass the trusted publication action.
  result=await call(`/v1/data/${project}/merch_products`,{
    method:'POST',
    token:seller.access_token,
    body:{data:{title:'Bypass product',price:1,active:true}},
  })
  assert.equal(result.response.status,403)

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
    body:{product_id:productId,quantity:2,size:'L',colour:'Black'},
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
    body:{product_id:productId,quantity:1,size:'XXL',colour:'Black'},
  })
  assert.equal(result.response.status,400)

  // Approved vetting is also enforced for marketplace adverts.
  result=await call(`/v3/actions/${project}/allegro-request-vetting`,{method:'POST',token:buyer.access_token,body:{}})
  assert.equal(result.response.status,200)
  result=await call(`/v3/actions/${project}/allegro-create-musician-ad`,{
    method:'POST',token:buyer.access_token,
    body:{title:'Need a jazz vocalist',description:'Seeking a vocalist for a synthetic recording collaboration.',poster_role:'Producer',looking_for:['Singer / vocalist'],genres:['Jazz']},
  })
  assert.equal(result.response.status,403)

  console.log('PASS IZAKHONO Core ALLEGRO commerce E2E')
  console.log('  ✓ self-approved vetting is blocked and admin review is required')
  console.log('  ✓ creator merch publication requires approved vetting server-side')
  console.log('  ✓ public catalogue reads work on v1 and v2 with the project key')
  console.log('  ✓ generic product/order write bypasses are blocked')
  console.log('  ✓ trusted order action enforces the 10% creator marketplace fee')
  console.log('  ✓ invalid variants and unvetted marketplace participation fail closed')
} finally {
  if (child.exitCode===null) {
    child.kill('SIGTERM')
    await Promise.race([once(child,'exit'),sleep(5000)])
    if (child.exitCode===null) child.kill('SIGKILL')
  }
  if (child.exitCode && child.exitCode!==0) console.error(stderr)
}
