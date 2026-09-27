import fs from 'node:fs';

const regPath='products/izakhono-super-app/public/module-registry.json';
const affiliatePath='products/izakhono-affiliate/affiliate-engine.v1.json';
const flowPath='products/izakhono-flow/.izakhono.json';
const financePath='products/izakhono-finance-core/finance-core.v1.json';
const creatorPath='products/izakhono-super-app/creator-engine.v1.json';
const registry=JSON.parse(fs.readFileSync(regPath,'utf8'));
const affiliate=JSON.parse(fs.readFileSync(affiliatePath,'utf8'));
const flow=JSON.parse(fs.readFileSync(flowPath,'utf8'));
const finance=JSON.parse(fs.readFileSync(financePath,'utf8'));
const creator=JSON.parse(fs.readFileSync(creatorPath,'utf8'));
const errors=[];

if(registry.schema!=='izakhono.super-app.module-registry.v1') errors.push('unexpected SUPER APP registry schema');
if(registry.infrastructure_policy!=='owned-first-externally-reversible') errors.push('SUPER APP must remain owned-first');
if(registry.privacy?.behavioural_tracking!==false) errors.push('behavioural tracking must remain disabled');
if(registry.privacy?.advertising_ids!==false) errors.push('advertising IDs must remain disabled');
if(registry.privacy?.silent_analytics!==false) errors.push('silent analytics must remain disabled');

const modules=new Map((registry.modules||[]).map(m=>[m.id,m]));
const aff=modules.get('affiliate');
if(!aff) errors.push('affiliate module missing from SUPER APP');
else {
  if(aff.route!=='/affiliate') errors.push('affiliate route must be /affiliate');
  if(aff.status!=='integrated') errors.push('affiliate module must be integrated');
  if(aff.engine!=='independent') errors.push('affiliate engine must remain independent');
}

const creatorModule=modules.get('creator');
if(!creatorModule) errors.push('Creator Engine module missing from SUPER APP');
else {
  if(creatorModule.route!=='/creator') errors.push('Creator Engine route must be /creator');
  if(creatorModule.status!=='integrated') errors.push('Creator Engine module must be integrated');
  if(creatorModule.engine!=='orchestrated-independent-engines') errors.push('Creator Engine must preserve independent underlying engines');
}
if(creator.schema!=='izakhono.creator-engine.v1') errors.push('unexpected Creator Engine contract schema');
if(creator.policy?.owned_first!==true) errors.push('Creator Engine must remain owned-first');
if(creator.policy?.external_adapters_replaceable!==true) errors.push('Creator Engine external adapters must remain replaceable');
if(creator.policy?.no_behavioural_tracking!==true) errors.push('Creator Engine behavioural tracking must remain disabled');
if(creator.policy?.no_advertising_ids!==true) errors.push('Creator Engine advertising IDs must remain disabled');
if(creator.policy?.no_raw_prompt_persistence!==true) errors.push('Creator Engine raw prompt persistence must remain disabled');
if(creator.launch_truth?.public_live!==false) errors.push('Creator Engine cannot be marked public-live without independent verification');
const capabilityIds=new Set((creator.capabilities||[]).map(x=>x.id));
for(const required of ['ideas','writing','research','design','video','audio','automation']){
  if(!capabilityIds.has(required)) errors.push('Creator Engine capability missing: '+required);
}
if(registry.creator_engine?.route!=='/creator') errors.push('SUPER APP creator_engine registry route drift');
if(registry.creator_engine?.public_live!==false) errors.push('SUPER APP registry must not claim Creator Engine public-live');

const flowModule=modules.get('flow');
if(!flowModule) errors.push('IZAKHONO FLOW module missing from SUPER APP');
else {
  if(flowModule.route!=='/flow') errors.push('FLOW route must be /flow');
  if(flowModule.status!=='integrated') errors.push('FLOW module must be integrated');
  if(flowModule.engine!=='independent') errors.push('FLOW engine must remain independent');
}
if(flow.slug!=='izakhono-flow') errors.push('FLOW canonical contract slug drift');
if(flow.infrastructure?.policy!=='owned-first-externally-reversible') errors.push('FLOW must remain owned-first');
if(flow.privacy?.tracking!==false || flow.privacy?.profiling!==false || flow.privacy?.advertisingIdentifiers!==false) errors.push('FLOW privacy contract drift');

const financeModule=modules.get('finance-core');
if(!financeModule) errors.push('FINANCE CORE module missing from SUPER APP');
else {
  if(financeModule.route!=='/finance-core') errors.push('FINANCE CORE route must be /finance-core');
  if(financeModule.status!=='integrated') errors.push('FINANCE CORE module must be integrated');
  if(financeModule.engine!=='independent') errors.push('FINANCE CORE engine must remain independent');
}
if(finance.schema!=='izakhono.finance-core.v1') errors.push('FINANCE CORE canonical contract drift');
if(finance.infrastructure?.policy!=='owned-first-externally-reversible') errors.push('FINANCE CORE must remain owned-first');
if(finance.regulated_activity_boundary?.deposit_taking_enabled!==false) errors.push('FINANCE CORE deposit taking must remain gated');
if(finance.regulated_activity_boundary?.credit_provider_enabled!==false) errors.push('FINANCE CORE credit-provider operation must remain gated');
if(finance.regulated_activity_boundary?.automated_final_credit_decisions_enabled!==false) errors.push('FINANCE CORE final automated credit decisions must remain gated');
if(finance.super_app_module?.module_id!=='finance-core' || finance.super_app_module?.route!=='/finance-core') errors.push('FINANCE CORE SUPER APP contract drift');

if(affiliate.super_app_module?.embedded!==true) errors.push('canonical affiliate contract must declare SUPER APP embedding');
if(affiliate.super_app_module?.route!=='/affiliate') errors.push('canonical affiliate route drift');
if(affiliate.super_app_module?.module_id!=='affiliate') errors.push('canonical affiliate module id drift');

const regAdapters=registry.affiliate?.adapters||[];
const canonicalAdapters=affiliate.external_adapters||[];
if(regAdapters.length!==canonicalAdapters.length) errors.push('SUPER APP adapter count drift');
for(const a of regAdapters){
  const canonical=canonicalAdapters.find(x=>x.id===a.id);
  if(!canonical) errors.push('SUPER APP has unknown adapter '+a.id);
  if(a.enabled!==false) errors.push(a.id+': cannot be marked connected without authenticated evidence');
}

for(const required of ['create','ads','crm','flow','finance-core','accountant','fortress','flowiq','tasks']){
  if(!modules.has(required)) errors.push('required SUPER APP module missing: '+required);
}

if(errors.length){
  console.error('IZAKHONO SUPER APP validation failed:');
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(JSON.stringify({
  ok:true,
  product:registry.product,
  modules:registry.modules.length,
  affiliate_embedded:true,
  creator_embedded:true,
  creator_route:'/creator',
  creator_capabilities:creator.capabilities.length,
  flow_embedded:true,
  finance_core_embedded:true,
  flow_route:'/flow',
  finance_core_route:'/finance-core',
  affiliate_route:'/affiliate',
  external_adapters:regAdapters.length,
  connected_external_adapters:regAdapters.filter(a=>a.enabled).length,
  owned_first:true,
  behavioural_tracking:false
},null,2));
