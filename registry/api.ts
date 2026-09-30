import { normalizeDomain } from './core';
import { MemoryRegistryStore } from './memory-store';
import { rdapDomain } from './rdap';
const store=new MemoryRegistryStore();
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}});
export async function registryFetch(request:Request){
  const url=new URL(request.url);
  if(url.pathname==='/health') return json({ok:true,service:'IZAKHONO REGISTRY',mode:'test-control-plane'});
  if(url.pathname==='/rdap/domain'){
    const name=url.searchParams.get('name'); if(!name) return json({ok:false,error:'name required'},400);
    return json(await rdapDomain(store,normalizeDomain(name)));
  }
  if(url.pathname==='/domain/check'){
    const name=url.searchParams.get('name'); if(!name) return json({ok:false,error:'name required'},400);
    return json({name:normalizeDomain(name),available:!(await store.getDomain(normalizeDomain(name)))});
  }
  return json({ok:false,error:'not found'},404);
}
