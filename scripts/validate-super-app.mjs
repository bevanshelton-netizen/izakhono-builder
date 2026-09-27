import fs from 'node:fs';

const regPath='products/izakhono-super-app/public/module-registry.json';
const affiliatePath='products/izakhono-affiliate/affiliate-engine.v1.json';
const registry=JSON.parse(fs.readFileSync(regPath,'utf8'));
const affiliate=JSON.parse(fs.readFileSync(affiliatePath,'utf8'));
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

for(const required of ['create','ads','crm','accountant','fortress','flowiq','tasks']){
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
  affiliate_route:'/affiliate',
  external_adapters:regAdapters.length,
  connected_external_adapters:regAdapters.filter(a=>a.enabled).length,
  owned_first:true,
  behavioural_tracking:false
},null,2));
