import { readFile } from 'node:fs/promises'

const coreUrl = String(process.env.IZAKHONO_CORE_URL || '').replace(/\/$/, '')
const adminToken = String(process.env.IZAKHONO_CORE_ADMIN_TOKEN || '')
if (!coreUrl) throw new Error('IZAKHONO_CORE_URL is required')
if (adminToken.length < 32) throw new Error('IZAKHONO_CORE_ADMIN_TOKEN is required')

const config = JSON.parse(await readFile(new URL('../config/allegro-vibez-policies.json', import.meta.url), 'utf8'))
const project = config.project

for (const [table, mode] of Object.entries(config.policies || {})) {
  const response = await fetch(`${coreUrl}/v2/admin/policies`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ project, table, mode }),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Failed to set ${table}=${mode}: HTTP ${response.status} ${text}`)
  console.log(`[PASS] ${table} -> ${mode}`)
}

console.log(`[PASS] ALLEGRO policy manifest applied to ${project}`)
console.log('No project key was rotated and no browser credential was changed.')
