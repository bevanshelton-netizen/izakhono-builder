import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'

const port = Number(process.env.IZ_CORE_PUBLIC_TEST_PORT || 18793)
const base = `http://127.0.0.1:${port}`
const adminToken = 'ci-admin-public-0123456789-abcdefghijklmnopqrstuvwxyz'
const jwtSecret = 'ci-jwt-public-0123456789-abcdefghijklmnopqrstuvwxyz'
const project = `public-ci-${Date.now()}`
const projectKey = 'pk_public_0123456789_abcdefghijklmnopqrstuvwxyz'

const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    IZAKHONO_CORE_ADMIN_TOKEN: adminToken,
    IZAKHONO_CORE_JWT_SECRET: jwtSecret,
    IZAKHONO_CORE_STORAGE_DIR: `/tmp/izakhono-core-public-${process.pid}`,
    IZAKHONO_CORE_ALLOWED_ORIGINS: 'https://allegro.test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr.on('data', chunk => { stderr += chunk })

async function http(path, { method='GET', token, key=projectKey, admin=false, body } = {}) {
  const headers = {}
  if (key) headers['X-Project-Key'] = key
  if (token) headers.Authorization = `Bearer ${token}`
  if (admin) headers.Authorization = `Bearer ${adminToken}`
  let requestBody
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }
  const response = await fetch(base + path, { method, headers, body: requestBody })
  const data = await response.json()
  return { response, data }
}

async function waitHealthy() {
  for (let i=0;i<80;i+=1) {
    try { if ((await fetch(base + '/healthz')).ok) return } catch {}
    if (child.exitCode !== null) throw new Error(`Core exited early: ${child.exitCode}\n${stderr}`)
    await sleep(250)
  }
  throw new Error('Core public-access health timeout\n' + stderr)
}

try {
  await waitHealthy()

  let result = await http('/v1/admin/projects', {
    method:'POST', key:null, admin:true,
    body:{ project, public_key:projectKey, allow_signup:true },
  })
  assert.equal(result.response.status, 201)

  const alice = await http(`/v1/auth/${project}/signup`, {
    method:'POST', body:{ email:'artist@example.test', password:'Artist-Strong-123!' },
  })
  assert.equal(alice.response.status, 201)

  const bob = await http(`/v1/auth/${project}/signup`, {
    method:'POST', body:{ email:'other@example.test', password:'Other-Strong-456!' },
  })
  assert.equal(bob.response.status, 201)

  result = await http('/v2/admin/policies', {
    method:'POST', key:null, admin:true,
    body:{ project, table:'public_profiles', mode:'owner', anonymous_select:true },
  })
  assert.equal(result.response.status, 200)
  assert.equal(result.data.anonymous_select, true)

  result = await http('/v2/admin/policies', {
    method:'POST', key:null, admin:true,
    body:{
      project, table:'artist_booking_intake', mode:'owner',
      anonymous_insert:true,
      anonymous_insert_fields:['artist_id','request_code','company_name','contact_email'],
      anonymous_owner_field:'artist_id',
    },
  })
  assert.equal(result.response.status, 200)

  const profile = await http(`/v2/data/${project}/public_profiles`, {
    method:'POST', token:alice.data.access_token,
    body:{ data:{ id:alice.data.user.id, stage_name:'ALICE', country:'South Africa' } },
  })
  assert.equal(profile.response.status, 201)

  const publicProfiles = await http(`/v2/data/${project}/public_profiles`)
  assert.equal(publicProfiles.response.status, 200)
  assert.equal(publicProfiles.data.length, 1)
  assert.equal(publicProfiles.data[0].stage_name, 'ALICE')

  const badPublicProfiles = await http(`/v2/data/${project}/public_profiles`, { key:'wrong-public-key-00000000000000000000' })
  assert.equal(badPublicProfiles.response.status, 401)

  const intake = await http(`/v2/data/${project}/artist_booking_intake`, {
    method:'POST',
    body:{ data:{
      artist_id:alice.data.user.id,
      request_code:'AB-TEST001',
      company_name:'Promoter One',
      contact_email:'promoter@example.test',
    }},
  })
  assert.equal(intake.response.status, 201)

  const unsafe = await http(`/v2/data/${project}/artist_booking_intake`, {
    method:'POST',
    body:{ data:{
      artist_id:alice.data.user.id,
      request_code:'AB-TEST002',
      company_name:'Promoter Two',
      contact_email:'p2@example.test',
      status:'confirmed',
    }},
  })
  assert.equal(unsafe.response.status, 403)

  const aliceIntake = await http(`/v2/data/${project}/artist_booking_intake`, { token:alice.data.access_token })
  assert.equal(aliceIntake.response.status, 200)
  assert.equal(aliceIntake.data.length, 1)
  assert.equal(aliceIntake.data[0].request_code, 'AB-TEST001')

  const bobIntake = await http(`/v2/data/${project}/artist_booking_intake`, { token:bob.data.access_token })
  assert.equal(bobIntake.response.status, 200)
  assert.deepEqual(bobIntake.data, [])

  const anonymousIntakeRead = await http(`/v2/data/${project}/artist_booking_intake`)
  assert.equal(anonymousIntakeRead.response.status, 401)

  const missingArtist = await http(`/v2/data/${project}/artist_booking_intake`, {
    method:'POST',
    body:{ data:{
      artist_id:'00000000-0000-0000-0000-000000000000',
      request_code:'AB-TEST003',
      company_name:'Promoter Three',
      contact_email:'p3@example.test',
    }},
  })
  assert.equal(missingArtist.response.status, 404)

  console.log('PASS IZAKHONO Core public-access E2E')
  console.log('  ✓ anonymous reads require explicit policy and valid project key')
  console.log('  ✓ anonymous intake inserts are field-allowlisted')
  console.log('  ✓ anonymous intake is assigned to the intended owner')
  console.log('  ✓ owner isolation remains intact after public intake')
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([once(child,'exit'), sleep(5000)])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
}
