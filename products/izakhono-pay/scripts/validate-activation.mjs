import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const registry = JSON.parse(fs.readFileSync(path.join(root, 'app-registry.json'), 'utf8'))
const factory = JSON.parse(fs.readFileSync(path.join(root, 'ACTIVATION-FACTORY.json'), 'utf8'))

const VALID = new Set(['READY_SANDBOX', 'BLOCKED', 'EVIDENCE_REQUIRED', 'READY_FOR_LIVE_REVIEW', 'LIVE'])
const requested = process.argv[2] || null
const app = (registry.apps || []).find((item) => item.slug === requested)

const checks = []
const add = (id, pass, detail, severity = 'blocker') => checks.push({ id, pass: Boolean(pass), detail, severity })

if (!app) {
  const available = (registry.apps || []).map((item) => item.slug).join(', ')
  console.error(JSON.stringify({ status: 'BLOCKED', reason: 'application_not_found', requested, available }, null, 2))
  process.exit(1)
}

add('registry_identity', Boolean(app.slug && app.repository && app.onboardedToIzakhonoSpace === true), 'Application has slug, repository and IZAKHONO onboarding.')
add('payment_gateway', app.paymentMode === 'disabled' || app.paymentGateway === 'izakhono-pay', `paymentMode=${app.paymentMode || 'missing'}, gateway=${app.paymentGateway || 'missing'}`)
add('payment_mode', app.paymentMode === 'disabled' || registry.policy?.modes?.includes(app.paymentMode), `paymentMode=${app.paymentMode || 'missing'}`)
add('server_side_contract', app.paymentMode === 'disabled' || factory.required_controls?.server_side_pay_url === true, 'PAY URL must remain server-side.')
add('secret_boundary', factory.safety?.no_client_service_role === true && factory.required_controls?.browser_secret_exposure === false, 'Service-role credentials must never reach browsers.')
add('idempotency', app.paymentMode === 'disabled' || factory.required_controls?.idempotency === true, 'Idempotency is required for payment creation.')
add('signed_webhooks', app.paymentMode === 'disabled' || factory.required_controls?.signed_webhooks === true, 'Signed webhook verification is required.')
add('audit_reconciliation', app.paymentMode === 'disabled' || (factory.required_controls?.audit_trail === true && factory.required_controls?.reconciliation === true), 'Audit trail and reconciliation are required.')

const sandboxReady = app.paymentMode === 'sandbox' && checks.every((check) => check.pass)
const liveGates = new Set(registry.policy?.liveRequires || factory.live_gate_requirements || [])
const evidenced = new Set(app.liveReadiness || [])
const missingGates = [...liveGates].filter((gate) => !evidenced.has(gate))
const acceptanceEvidence = evidenced.has('end_to_end_acceptance') || evidenced.has('ACCEPTANCE_SUITE')
const liveEvidenceReady = app.paymentMode === 'live' && missingGates.length === 0 && acceptanceEvidence

if (app.paymentMode === 'live') {
  add('live_gate_evidence', missingGates.length === 0, missingGates.length ? `Missing: ${missingGates.join(', ')}` : 'All configured live gates evidenced.')
  add('acceptance_evidence', acceptanceEvidence, 'Production/live activation requires acceptance evidence.')
}

let status
if (app.paymentMode === 'disabled') status = 'BLOCKED'
else if (!checks.every((check) => check.pass)) status = 'BLOCKED'
else if (app.paymentMode === 'sandbox') status = 'READY_SANDBOX'
else if (app.paymentMode === 'live' && liveEvidenceReady) status = 'LIVE'
else if (app.paymentMode === 'live' && missingGates.length) status = 'EVIDENCE_REQUIRED'
else status = 'READY_FOR_LIVE_REVIEW'

if (!VALID.has(status)) throw new Error(`Invalid activation status: ${status}`)

const output = {
  product: 'IZAKHONO PAY',
  validator_version: '1.0',
  app: app.slug,
  payment_mode: app.paymentMode,
  status,
  money_movement_allowed: status === 'LIVE',
  live_review_required: status === 'READY_FOR_LIVE_REVIEW',
  missing_live_gates: missingGates,
  checks,
  fail_closed: true,
  generated_at: new Date().toISOString()
}

console.log(JSON.stringify(output, null, 2))
if (status === 'BLOCKED' || status === 'EVIDENCE_REQUIRED') process.exit(1)
