import fs from 'node:fs';

const path = 'products/izakhono-affiliate/affiliate-engine.v1.json';
const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
const errors = [];

if (cfg.schema !== 'izakhono.affiliate.engine.v1') errors.push('unexpected affiliate engine schema');
if (cfg.infrastructure?.policy !== 'owned-first-externally-reversible') errors.push('owned-first policy required');
if (cfg.infrastructure?.system_of_record !== 'IZAKHONO-owned infrastructure') errors.push('IZAKHONO must remain system of record');
if (cfg.infrastructure?.external_networks !== 'replaceable adapters only') errors.push('external networks must remain replaceable adapters');
if (cfg.tracking?.behavioural_profiling !== false) errors.push('behavioural profiling must remain disabled');
if (cfg.tracking?.advertising_ids !== false) errors.push('advertising IDs must remain disabled');
if (cfg.tracking?.consent_and_disclosure_required !== true) errors.push('affiliate disclosure and consent controls required');
if (cfg.payouts?.verified_conversion_required !== true) errors.push('payouts require verified conversion');
if (cfg.payouts?.fraud_clearance_required !== true) errors.push('payouts require fraud clearance');
if (cfg.launch_policy?.no_external_adapter_may_become_system_of_record !== true) errors.push('external adapters cannot become system of record');
if (cfg.super_app_module?.embedded !== true) errors.push('affiliate must be embedded in IZAKHONO SUPER APP');
if (cfg.super_app_module?.route !== '/affiliate') errors.push('affiliate SUPER APP route must be /affiliate');
if (cfg.super_app_module?.engine !== 'independent') errors.push('affiliate engine must remain independently deployable');

const automatic = new Set(cfg.autonomy?.automatic || []);
const gated = new Set(cfg.autonomy?.requires_owner_or_authorised_officer || []);
for (const item of [
  'ingest_approved_offer_feeds',
  'generate_subids_and_tracking_links',
  'reconcile_click_conversion_commission_events',
  'pause broken or policy-invalid adapters'
]) if (!automatic.has(item)) errors.push('missing automatic capability: ' + item);

for (const item of [
  'accept_network_legal_terms',
  'submit banking_or_tax_identity_data',
  'authorise_paid_media_spend'
]) if (!gated.has(item)) errors.push('missing owner gate: ' + item);

const adapters = cfg.external_adapters || [];
if (adapters.length < 5) errors.push('affiliate adapter registry is unexpectedly small');
for (const a of adapters) {
  if (!a.id || !a.label) errors.push('adapter missing id/label');
  if (a.credential_mode !== 'server-side') errors.push(a.id + ': credentials must be server-side');
}

if (errors.length) {
  console.error('IZAKHONO Affiliate Engine validation failed:');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  engine: cfg.engine,
  adapters: adapters.length,
  publisher_mode: cfg.operating_modes?.publisher?.enabled === true,
  izakhono_network_mode: cfg.operating_modes?.izakhono_network?.enabled === true,
  owned_first: true,
  behavioural_profiling: false
}, null, 2));
