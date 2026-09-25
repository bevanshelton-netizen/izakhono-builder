import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'

const port = Number(process.env.IZ_CORE_ALLEGRO_BOOKING_TEST_PORT || 18794)
const base = `http://127.0.0.1:${port}`
const adminToken = 'ci-allegro-booking-admin-0123456789-abcdefghijklmnopqrstuvwxyz'
const jwtSecret = 'ci-allegro-booking-jwt-0123456789-abcdefghijklmnopqrstuvwxyz'
const project = `allegro-booking-ci-${Date.now()}`
const projectKey = 'pk_allegro_booking_0123456789_abcdefghijklmnopqrstuvwxyz'

const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    IZAKHONO_CORE_ADMIN_TOKEN: adminToken,
    IZAKHONO_CORE_JWT_SECRET: jwtSecret,
    IZAKHONO_CORE_STORAGE_DIR: `/tmp/izakhono-allegro-booking-${process.pid}`,
    IZAKHONO_CORE_ALLOWED_ORIGINS: 'https://allegro.test',
  },
  stdio: ['ignore','pipe','pipe'],
})

let stderr=''
child.stderr.on('data',chunk=>{stderr+=chunk})

async function call(path,{method='GET',token,key=projectKey,body}={}) {
  const headers={}
  if(key)headers['X-Project-Key']=key
  if(token)headers.Authorization=`Bearer ${token}`
  if(body!==undefined)headers['Content-Type']='application/json'
  const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)})
  const text=await response.text()
  let data
  try{data=text?JSON.parse(text):null}catch{data=text}
  return {response,data}
}

async function waitHealthy(){
  for(let i=0;i<80;i+=1){
    try{if((await fetch(base+'/healthz')).ok)return}catch{}
    if(child.exitCode!==null)throw new Error(`Core exited early: ${child.exitCode}\n${stderr}`)
    await sleep(250)
  }
  throw new Error('Core booking-intake health timeout\n'+stderr)
}

async function signup(email){
  const result=await call(`/v1/auth/${project}/signup`,{method:'POST',body:{email,password:'Allegro-Booking-Strong-123!'}})
  assert.equal(result.response.status,201,JSON.stringify(result.data))
  return result.data
}

try{
  await waitHealthy()

  let result=await call('/v1/admin/projects',{
    method:'POST',key:null,token:adminToken,
    body:{project,public_key:projectKey,allow_signup:true,table_policies:{artist_booking_intake:'owner'}},
  })
  assert.equal(result.response.status,201,JSON.stringify(result.data))

  const artist=await signup('artist@allegro.example.test')
  const other=await signup('other@allegro.example.test')

  result=await call('/v2/admin/policies',{
    method:'POST',key:null,token:adminToken,
    body:{
      project,table:'artist_booking_intake',mode:'owner',
      anonymous_insert:true,
      anonymous_insert_fields:['artist_id','request_code','company_name','contact_name','contact_email','contact_phone','performance_type','event_date','venue_address','event_description','privacy_consent','source'],
      anonymous_owner_field:'artist_id',
    },
  })
  assert.equal(result.response.status,200,JSON.stringify(result.data))
  assert.equal(result.data.anonymous_insert,true)

  result=await call(`/v2/data/${project}/artist_booking_intake`,{
    method:'POST',
    body:{data:{
      artist_id:artist.user.id,
      request_code:'AB-OWNED001',
      company_name:'Promoter One',
      contact_name:'Booking Contact',
      contact_email:'promoter@example.test',
      contact_phone:'+27110000000',
      performance_type:'Festival',
      event_date:'2026-12-01',
      venue_address:'Johannesburg, South Africa',
      event_description:'Synthetic owned-infrastructure booking intake test.',
      privacy_consent:true,
      source:'artist_space',
    }},
  })
  assert.equal(result.response.status,201,JSON.stringify(result.data))
  assert.equal(result.data.request_code,'AB-OWNED001')

  result=await call(`/v2/data/${project}/artist_booking_intake`,{
    method:'POST',
    body:{data:{
      artist_id:artist.user.id,
      request_code:'AB-OWNED002',
      company_name:'Unsafe Promoter',
      contact_name:'Unsafe',
      contact_email:'unsafe@example.test',
      contact_phone:'+27110000001',
      performance_type:'Private event',
      event_date:'2026-12-02',
      venue_address:'Pretoria, South Africa',
      event_description:'Attempt to inject a protected workflow field.',
      privacy_consent:true,
      source:'artist_space',
      status:'confirmed',
    }},
  })
  assert.equal(result.response.status,403)

  const artistRows=await call(`/v2/data/${project}/artist_booking_intake`,{token:artist.access_token})
  assert.equal(artistRows.response.status,200,JSON.stringify(artistRows.data))
  assert.equal(artistRows.data.length,1)
  assert.equal(artistRows.data[0].request_code,'AB-OWNED001')

  const otherRows=await call(`/v2/data/${project}/artist_booking_intake`,{token:other.access_token})
  assert.equal(otherRows.response.status,200,JSON.stringify(otherRows.data))
  assert.deepEqual(otherRows.data,[])

  const anonymousRead=await call(`/v2/data/${project}/artist_booking_intake`)
  assert.equal(anonymousRead.response.status,401)

  const wrongKey=await call(`/v2/data/${project}/artist_booking_intake`,{
    method:'POST',key:'pk_wrong_booking_0123456789_abcdefghijklmnopqrstuvwxyz',
    body:{data:{artist_id:artist.user.id,request_code:'AB-OWNED003',company_name:'Nope',contact_name:'Nope',contact_email:'n@example.test',contact_phone:'000000',performance_type:'Live performance',event_date:'2026-12-03',venue_address:'Nowhere',event_description:'Wrong project key must fail.',privacy_consent:true,source:'artist_space'}},
  })
  assert.equal(wrongKey.response.status,401)

  const missingOwner=await call(`/v2/data/${project}/artist_booking_intake`,{
    method:'POST',
    body:{data:{artist_id:'00000000-0000-0000-0000-000000000000',request_code:'AB-OWNED004',company_name:'Missing',contact_name:'Missing',contact_email:'m@example.test',contact_phone:'000000',performance_type:'Live performance',event_date:'2026-12-04',venue_address:'Nowhere',event_description:'Unknown artist owner must fail closed.',privacy_consent:true,source:'artist_space'}},
  })
  assert.equal(missingOwner.response.status,404)

  console.log('PASS IZAKHONO Core ALLEGRO booking intake E2E')
  console.log('  ✓ public booking intake requires the browser-safe project key')
  console.log('  ✓ only allowlisted enquiry fields may be inserted')
  console.log('  ✓ protected workflow fields cannot be forged')
  console.log('  ✓ intake is assigned to the intended artist owner')
  console.log('  ✓ artist isolation blocks other creators and anonymous reads')
}finally{
  if(child.exitCode===null){
    child.kill('SIGTERM')
    await Promise.race([once(child,'exit'),sleep(5000)])
    if(child.exitCode===null)child.kill('SIGKILL')
  }
  if(child.exitCode&&child.exitCode!==0)console.error(stderr)
}
