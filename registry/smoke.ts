import { registryFetch } from './api';

async function main(){
  const health=await registryFetch(new Request('https://registry.test/health'));
  if(health.status!==200) throw new Error('health failed');
  const check=await registryFetch(new Request('https://registry.test/domain/check?name=alpha.izt'));
  const data=await check.json() as {available:boolean};
  if(!data.available) throw new Error('private test domain should be available');
  const create=await registryFetch(new Request('https://registry.test/domain/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'alpha.izt',registrarId:'local-test',registrantId:'contact-test',nameservers:['ns1.izakhono.test','ns2.izakhono.test']})}));
  if(create.status!==201) throw new Error('create failed');
  const rdap=await registryFetch(new Request('https://registry.test/rdap/domain?name=alpha.izt'));
  if(rdap.status!==200) throw new Error('rdap failed');
}
main();
