import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'
import WebSocket from 'ws'

const port = Number(process.env.IZ_CORE_TEST_PORT || 18787)
const base = `http://127.0.0.1:${port}`
const adminToken = 'ci-admin-token-0123456789-abcdefghijklmnopqrstuvwxyz'
const jwtSecret = 'ci-jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const project = `core-ci-${Date.now()}`
const projectKey = 'pk_ci_0123456789_abcdefghijklmnopqrstuvwxyz'

const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    IZAKHONO_CORE_ADMIN_TOKEN: adminToken,
    IZAKHONO_CORE_JWT_SECRET: jwtSecret,
    IZAKHONO_CORE_STORAGE_DIR: `/tmp/izakhono-core-e2e-${process.pid}`,
    IZAKHONO_CORE_ALLOWED_ORIGINS: 'https://example.test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''
child.stdout.on('data', chunk => { stdout += chunk })
child.stderr.on('data', chunk => { stderr += chunk })

async function http(path, { method = 'GET', token, key = projectKey, body, rawBody, headers = {} } = {}) {
  const finalHeaders = { ...headers }
  if (key) finalHeaders['X-Project-Key'] = key
  if (token) finalHeaders.Authorization = `Bearer ${token}`
  let requestBody
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  } else if (rawBody !== undefined) {
    requestBody = rawBody
  }
  const response = await fetch(`${base}${path}`, { method, headers: finalHeaders, body: requestBody })
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer())
  return { response, data }
}

async function waitHealthy() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`${base}/healthz`)
      if (response.ok) return
    } catch {}
    if (child.exitCode !== null) throw new Error(`Core exited early: ${child.exitCode}\n${stderr}`)
    await sleep(250)
  }
  throw new Error(`Core health timeout\nstdout:\n${stdout}\nstderr:\n${stderr}`)
}

function openRealtime(session) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/realtime/${project}?project_key=${encodeURIComponent(projectKey)}&access_token=${encodeURIComponent(session.access_token)}`)
    const messages = []
    const timer = setTimeout(() => reject(new Error('Realtime connection timeout')), 5000)
    ws.on('message', raw => {
      const message = JSON.parse(String(raw))
      messages.push(message)
      if (message.type === 'ready') {
        clearTimeout(timer)
        resolve({ ws, messages })
      }
    })
    ws.on('error', reject)
  })
}

async function waitForMessage(connection, predicate, timeoutMs = 3000) {
  const existing = connection.messages.find(predicate)
  if (existing) return existing
  return new Promise((resolve, reject) => {
    const onMessage = raw => {
      const message = JSON.parse(String(raw))
      if (predicate(message)) {
        cleanup()
        resolve(message)
      }
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for realtime event'))
    }, timeoutMs)
    function cleanup() {
      clearTimeout(timer)
      connection.ws.off('message', onMessage)
    }
    connection.ws.on('message', onMessage)
  })
}

async function assertNoMessage(connection, predicate, timeoutMs = 600) {
  const before = connection.messages.filter(predicate).length
  await sleep(timeoutMs)
  const after = connection.messages.filter(predicate).length
  assert.equal(after, before, 'Unexpected realtime event leaked to another owner')
}

try {
  await waitHealthy()

  let result = await http('/v1/admin/projects', {
    method: 'POST',
    key: null,
    token: adminToken,
    body: { project, public_key: projectKey, allow_signup: true, table_policies: { shared_notes: 'project' } },
  })
  assert.equal(result.response.status, 201)
  assert.equal(result.data.project, project)

  const badKey = await http(`/v1/auth/${project}/signup`, {
    method: 'POST',
    key: 'wrong-project-key-00000000000000000000',
    body: { email: 'nobody@example.test', password: 'Strong-pass-123!' },
  })
  assert.equal(badKey.response.status, 401)

  const aliceSignup = await http(`/v1/auth/${project}/signup`, {
    method: 'POST',
    body: { email: 'alice@example.test', password: 'Alice-Strong-123!', user_metadata: { name: 'Alice' } },
  })
  assert.equal(aliceSignup.response.status, 201)
  const alice = aliceSignup.data

  const bobSignup = await http(`/v1/auth/${project}/signup`, {
    method: 'POST',
    body: { email: 'bob@example.test', password: 'Bob-Strong-456!', user_metadata: { name: 'Bob' } },
  })
  assert.equal(bobSignup.response.status, 201)
  const bob = bobSignup.data

  const aliceRealtime = await openRealtime(alice)
  const bobRealtime = await openRealtime(bob)

  const privateInsert = await http(`/v1/data/${project}/private_notes`, {
    method: 'POST',
    token: alice.access_token,
    body: { data: { title: 'Alice only', body: 'private' } },
  })
  assert.equal(privateInsert.response.status, 201)
  const privateId = privateInsert.data.id
  await waitForMessage(aliceRealtime, m => m.type === 'row.changed' && m.table === 'private_notes' && m.row?.id === privateId)
  await assertNoMessage(bobRealtime, m => m.type === 'row.changed' && m.table === 'private_notes' && m.row?.id === privateId)

  const bobPrivateList = await http(`/v1/data/${project}/private_notes`, { token: bob.access_token })
  assert.equal(bobPrivateList.response.status, 200)
  assert.deepEqual(bobPrivateList.data, [])

  const alicePrivateList = await http(`/v1/data/${project}/private_notes`, { token: alice.access_token })
  assert.equal(alicePrivateList.response.status, 200)
  assert.equal(alicePrivateList.data.length, 1)
  assert.equal(alicePrivateList.data[0].title, 'Alice only')

  const sharedInsert = await http(`/v1/data/${project}/shared_notes`, {
    method: 'POST',
    token: alice.access_token,
    body: { data: { title: 'Shared note', state: 'new' } },
  })
  assert.equal(sharedInsert.response.status, 201)
  const sharedId = sharedInsert.data.id
  await waitForMessage(aliceRealtime, m => m.type === 'row.changed' && m.table === 'shared_notes' && m.row?.id === sharedId)
  await waitForMessage(bobRealtime, m => m.type === 'row.changed' && m.table === 'shared_notes' && m.row?.id === sharedId)

  const bobSharedList = await http(`/v1/data/${project}/shared_notes`, { token: bob.access_token })
  assert.equal(bobSharedList.response.status, 200)
  assert.equal(bobSharedList.data.length, 1)

  const bobPatch = await http(`/v1/data/${project}/shared_notes/${sharedId}`, {
    method: 'PATCH',
    token: bob.access_token,
    body: { data: { state: 'reviewed' } },
  })
  assert.equal(bobPatch.response.status, 200)
  assert.equal(bobPatch.data.state, 'reviewed')

  const bobCannotPatchAlice = await http(`/v1/data/${project}/private_notes/${privateId}`, {
    method: 'PATCH',
    token: bob.access_token,
    body: { data: { title: 'stolen' } },
  })
  assert.equal(bobCannotPatchAlice.response.status, 404)

  const refreshed = await http(`/v1/auth/${project}/refresh`, {
    method: 'POST',
    body: { refresh_token: alice.refresh_token },
  })
  assert.equal(refreshed.response.status, 200)
  assert.notEqual(refreshed.data.refresh_token, alice.refresh_token)

  const replayedRefresh = await http(`/v1/auth/${project}/refresh`, {
    method: 'POST',
    body: { refresh_token: alice.refresh_token },
  })
  assert.equal(replayedRefresh.response.status, 401)

  const content = Buffer.from('owner-private-object')
  const storagePut = await http(`/v1/storage/${project}/documents/alice/test.txt`, {
    method: 'PUT',
    token: refreshed.data.access_token,
    rawBody: content,
    headers: { 'Content-Type': 'text/plain' },
  })
  assert.equal(storagePut.response.status, 201)
  assert.equal(storagePut.data.size, content.length)

  const storageGet = await http(`/v1/storage/${project}/documents/alice/test.txt`, { token: refreshed.data.access_token })
  assert.equal(storageGet.response.status, 200)
  assert.equal(storageGet.data.toString('utf8'), content.toString('utf8'))

  const bobStorageGet = await http(`/v1/storage/${project}/documents/alice/test.txt`, { token: bob.access_token })
  assert.equal(bobStorageGet.response.status, 404)

  const me = await http(`/v1/auth/${project}/me`, { token: refreshed.data.access_token })
  assert.equal(me.response.status, 200)
  assert.equal(me.data.email, 'alice@example.test')

  const signout = await http(`/v1/auth/${project}/signout`, {
    method: 'POST',
    token: refreshed.data.access_token,
    body: { refresh_token: refreshed.data.refresh_token },
  })
  assert.equal(signout.response.status, 200)

  const signedOutRefresh = await http(`/v1/auth/${project}/refresh`, {
    method: 'POST',
    body: { refresh_token: refreshed.data.refresh_token },
  })
  assert.equal(signedOutRefresh.response.status, 401)

  aliceRealtime.ws.close()
  bobRealtime.ws.close()

  console.log('PASS IZAKHONO Core E2E')
  console.log('  ✓ project keys and JWT project boundaries enforced')
  console.log('  ✓ password auth and one-time refresh rotation')
  console.log('  ✓ owner-default row isolation and explicit project-shared policy')
  console.log('  ✓ owner-private storage')
  console.log('  ✓ realtime respects owner isolation and project-shared policy')
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([once(child, 'exit'), sleep(5000)])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  if (child.exitCode && child.exitCode !== 0) {
    console.error(stdout)
    console.error(stderr)
  }
}
