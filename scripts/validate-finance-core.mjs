import fs from 'node:fs';

const contract=JSON.parse(fs.readFileSync('products/izakhono-finance-core/finance-core.v1.json','utf8'));
const product=JSON.parse(fs.readFileSync('products/izakhono-finance-core/.izakhono.json','utf8'));
const server=fs.readFileSync('products/izakhono-finance-core/server.mjs','utf8');
const compose=fs.readFileSync('products/izakhono-finance-core/node01/docker-compose.yml','utf8');
const envExample=fs.readFileSync('products/izakhono-finance-core/node01/.env.example','utf8');
const errors=[];

if(contract.schema!=='izakhono.finance-core.v1') errors.push('unexpected FINANCE CORE schema');
if(contract.version!=='0.2.0') errors.push('FINANCE CORE contract version must be 0.2.0');
if(contract.infrastructure?.policy!=='owned-first-externally-reversible') errors.push('FINANCE CORE must remain owned-first');
if(contract.infrastructure?.system_of_record!=='IZAKHONO-owned infrastructure') errors.push('FINANCE CORE system of record must remain owned');
if(contract.infrastructure?.owned_target!=='NODE01') errors.push('FINANCE CORE owned target must remain NODE01');
if(contract.privacy?.behavioural_tracking!==false || contract.privacy?.advertising_ids!==false || contract.privacy?.silent_analytics!==false) errors.push('FINANCE CORE privacy contract drift');
if(contract.regulated_activity_boundary?.software_vendor_only_by_default!==true) errors.push('software-vendor boundary missing');
if(contract.regulated_activity_boundary?.deposit_taking_enabled!==false) errors.push('deposit taking must remain disabled by default');
if(contract.regulated_activity_boundary?.credit_provider_enabled!==false) errors.push('credit-provider operation must remain disabled by default');
if(contract.regulated_activity_boundary?.automated_final_credit_decisions_enabled!==false) errors.push('final automated credit decisions must remain disabled');
if(contract.regulated_activity_boundary?.money_movement_without_authorised_payment_adapter!==false) errors.push('uncontrolled money movement must remain disabled');
if(contract.security?.institution_scope_required!==true || contract.security?.legal_entity_scope_required!==true) errors.push('institution + entity isolation required');
if(contract.security?.distinct_maker_checker_principals_required!==true) errors.push('distinct maker/checker principals must be required');
if(contract.security?.audit_hash_chain_required!==true) errors.push('hash-chained audit must be required');
if(contract.security?.encrypted_persistence_required!==true) errors.push('encrypted persistence must be required');
if(contract.security?.backup_checksum_manifest_required!==true) errors.push('backup checksum manifest must be required');
if(contract.security?.idempotent_payment_reference_ingest!==true) errors.push('payment-reference ingest must remain idempotent');
if(contract.super_app_module?.module_id!=='finance-core' || contract.super_app_module?.route!=='/finance-core' || contract.super_app_module?.engine!=='independent') errors.push('SUPER APP module contract drift');
if(product.slug!=='izakhono-finance-core') errors.push('product slug drift');
if(product.application_version!=='0.2.0') errors.push('product application version drift');
if(product.infrastructure?.owned_target!=='NODE01') errors.push('owned target must remain NODE01');
if(product.infrastructure?.current_public_route!=='NOT_YET_VERIFIED') errors.push('public status cannot be claimed without evidence');
if(!server.includes('maker_checker_separation_required')) errors.push('maker-checker runtime enforcement missing');
if(!server.includes('audit chain invalid')) errors.push('audit-chain runtime enforcement missing');
if(!server.includes('idempotent_replay:true')) errors.push('payment-reference idempotency missing');
if(!server.includes('/api/institution-configs')) errors.push('institution configuration API missing');
if(!server.includes('/api/product-configs')) errors.push('product configuration API missing');
if(!server.includes('/api/servicing-loans')) errors.push('servicing-loan API missing');
if(!server.includes('/allocate-repayment')) errors.push('repayment allocation API missing');
if(!server.includes('/api/arrears')) errors.push('arrears reporting API missing');
if(!server.includes('/api/collection-cases')) errors.push('collections case API missing');
if(!server.includes('principal_disbursed_by_finance_core:false')) errors.push('servicing records must not imply FINANCE CORE disbursement authority');
if(!server.includes('automated_contact:false')) errors.push('collections automation must remain off by default');
if(!compose.includes('127.0.0.1:8797:8797')) errors.push('NODE01 package must bind FINANCE CORE to loopback only');
if(!compose.includes('no-new-privileges:true')) errors.push('NODE01 no-new-privileges control missing');
if(!compose.includes('cap_drop:')) errors.push('NODE01 capability drop missing');
if(!envExample.includes('FINANCE_ALLOW_INSECURE_LOCAL=false')) errors.push('NODE01 insecure-local mode must be disabled');
if(!envExample.includes('FINANCE_DATA_KEY_FILE=')) errors.push('NODE01 secret-file key path missing');

for(const file of [
  'products/izakhono-finance-core/ops/backup.mjs',
  'products/izakhono-finance-core/ops/restore.mjs',
  'products/izakhono-finance-core/ops/node01-preflight.mjs',
  'products/izakhono-finance-core/node01/README.md'
]){
  if(!fs.existsSync(file)) errors.push('required hardening asset missing: '+file);
}

if(errors.length){
  console.error('IZAKHONO FINANCE CORE validation failed:');
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(JSON.stringify({
  ok:true,
  product:contract.product,
  version:contract.version,
  engine:'independent',
  owned_first:true,
  maker_checker:true,
  audit_hash_chain:true,
  backup_restore_packaged:true,
  node01_packaged:true,
  operating_mvp:true,
  institution_config:true,
  product_config:true,
  servicing_records:true,
  arrears_reporting:true,
  regulated_activity_gated:true,
  public_live:false
},null,2));
