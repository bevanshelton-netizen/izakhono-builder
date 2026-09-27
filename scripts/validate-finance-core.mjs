import fs from 'node:fs';

const contract=JSON.parse(fs.readFileSync('products/izakhono-finance-core/finance-core.v1.json','utf8'));
const product=JSON.parse(fs.readFileSync('products/izakhono-finance-core/.izakhono.json','utf8'));
const errors=[];

if(contract.schema!=='izakhono.finance-core.v1') errors.push('unexpected FINANCE CORE schema');
if(contract.infrastructure?.policy!=='owned-first-externally-reversible') errors.push('FINANCE CORE must remain owned-first');
if(contract.infrastructure?.system_of_record!=='IZAKHONO-owned infrastructure') errors.push('FINANCE CORE system of record must remain owned');
if(contract.privacy?.behavioural_tracking!==false || contract.privacy?.advertising_ids!==false || contract.privacy?.silent_analytics!==false) errors.push('FINANCE CORE privacy contract drift');
if(contract.regulated_activity_boundary?.software_vendor_only_by_default!==true) errors.push('software-vendor boundary missing');
if(contract.regulated_activity_boundary?.deposit_taking_enabled!==false) errors.push('deposit taking must remain disabled by default');
if(contract.regulated_activity_boundary?.credit_provider_enabled!==false) errors.push('credit-provider operation must remain disabled by default');
if(contract.regulated_activity_boundary?.automated_final_credit_decisions_enabled!==false) errors.push('final automated credit decisions must remain disabled');
if(contract.regulated_activity_boundary?.money_movement_without_authorised_payment_adapter!==false) errors.push('uncontrolled money movement must remain disabled');
if(contract.security?.institution_scope_required!==true || contract.security?.legal_entity_scope_required!==true) errors.push('institution + entity isolation required');
if(contract.super_app_module?.module_id!=='finance-core' || contract.super_app_module?.route!=='/finance-core' || contract.super_app_module?.engine!=='independent') errors.push('SUPER APP module contract drift');
if(product.slug!=='izakhono-finance-core') errors.push('product slug drift');
if(product.infrastructure?.owned_target!=='NODE01') errors.push('owned target must remain NODE01');
if(product.infrastructure?.current_public_route!=='NOT_YET_VERIFIED') errors.push('public status cannot be claimed without evidence');

if(errors.length){
  console.error('IZAKHONO FINANCE CORE validation failed:');
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(JSON.stringify({ok:true,product:contract.product,version:contract.version,engine:'independent',owned_first:true,regulated_activity_gated:true,public_live:false},null,2));
