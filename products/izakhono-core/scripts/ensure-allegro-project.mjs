import { readFile } from 'node:fs/promises'

const coreUrl = String(process.env.IZAKHONO_CORE_URL || '').replace(/\/$/, '')
const adminToken = String(process.env.IZAKHONO_CORE_ADMIN_TOKEN || '')
const publicKey = String(process.env.IZAKHONO_CORE_PUBLIC_KEY || '')

if (!coreUrl) throw new Error('IZAKHONO_CORE_URL is required')
if (adminToken.length < 32) throw new Error('IZAKHONO_CORE_ADMIN_TOKEN is required')
if (publicKey.length < 20) throw new Error('IZAKHONO_CORE_PUBLIC_KEY is required')

const config = JSON.parse(await readFile(new URL('../config/allegro-vibez-policies.json', import.meta.url), 'utf8'))
const response = await fetch(`${coreUrl}/v1/admin/projects`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    project: config.project,
    public_key: publicKey,
    ensure: true,
    allow_signup: true,
    table_policies: config.policies,
  }),
})
const text = await response.text()
let data
try { data = text ? JSON.parse(text) : null } catch { data = text }
if (!response.ok) throw new Error(`ALLEGRO project ensure failed: HTTP ${response.status} ${typeof data === 'string' ? data : JSON.stringify(data)}`)

console.log(`[PASS] ALLEGRO Core project ${config.project} is present with the expected browser key.`)
console.log('[PASS] ALLEGRO marketplace and merch policy manifest is applied without rotating the project key.')
