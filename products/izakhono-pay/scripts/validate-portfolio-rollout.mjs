import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const registryPath = path.resolve(here, '..', 'app-registry.json')
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))

const allowedModes = new Set(registry.policy?.modes || [])
const requiredLiveGates = new Set(registry.policy?.liveRequires || [])
const slugs = new Set()
const failures = []

for (const app of registry.apps || []) {
  const prefix = app.slug || '<missing-slug>'

  if (!app.slug) failures.push('app missing slug')
  if (app.slug && slugs.has(app.slug)) failures.push(`${prefix}: duplicate slug`)
  if (app.slug) slugs.add(app.slug)

  if (!app.repository) failures.push(`${prefix}: repository missing`)
  if (app.onboardedToIzakhonoSpace !== true) failures.push(`${prefix}: not onboarded to IZAKHONO space`)

  if (app.paymentMode !== 'disabled') {
    if (app.paymentGateway !== 'izakhono-pay') failures.push(`${prefix}: payment gateway must be izakhono-pay`)
    if (!allowedModes.has(app.paymentMode)) failures.push(`${prefix}: invalid paymentMode ${app.paymentMode}`)
  }

  if (app.paymentMode === 'live') {
    for (const gate of requiredLiveGates) {
      if (!app.liveReadiness?.includes?.(gate)) failures.push(`${prefix}: live gate not evidenced: ${gate}`)
    }
  }
}

const paymentEnabled = (registry.apps || []).filter((app) => app.paymentMode !== 'disabled')
const sandboxApps = paymentEnabled.filter((app) => app.paymentMode === 'sandbox')
const liveApps = paymentEnabled.filter((app) => app.paymentMode === 'live')
const disabledApps = (registry.apps || []).filter((app) => app.paymentMode === 'disabled')

console.log(`IZAKHONO PAY portfolio registry v${registry.version}`)
console.log(`Onboarded applications: ${(registry.apps || []).length}`)
console.log(`Payment-enabled: ${paymentEnabled.length}`)
console.log(`Sandbox: ${sandboxApps.length}`)
console.log(`Live: ${liveApps.length}`)
console.log(`Disabled: ${disabledApps.length}`)

for (const app of paymentEnabled) {
  console.log(`READY ${app.slug} -> ${app.paymentGateway} (${app.paymentMode}) :: ${app.status}`)
}

for (const app of disabledApps) {
  console.log(`HOLD ${app.slug} (${app.status})`)
}

if (failures.length) {
  console.error('\nPortfolio rollout validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nPortfolio rollout registry is valid. Applications remain sandboxed until live readiness is evidenced.')
