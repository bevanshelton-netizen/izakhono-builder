import {normalizeDomain,createDomain,RegistryStore} from './core';
import {MemoryRegistryStore} from './memory-store';
import {rdapDomain} from './rdap';
import {eppHandle} from './epp-server';
import {bearerValid} from './security';

const memory=new MemoryRegistryStore();
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export interface RegistryEnv{REGISTRY_TOKEN_SHA256?:string;APP_ENV?:string}
export async function registryFetch(request:Request,store:RegistryStore=memory,env:RegistryEnv={}){
 const url=new URL(request.url);
 if(url.pathname==='/health')return json({ok:true,service:'IZAKHONO REGISTRY',mode:env.APP_ENV==='production'?'persistent-control-plane':'test-control-plane'});
 if(url.pathname==='/domain/check'){
  const name=url.searchParams.get('name');if(!name)return json({ok:false,error:'name required'},400);
  try{const normalized=normalizeDomain(name);return json({name:normalized,available:!(await store.getDomain(normalized))});}catch(e){return json({ok:false,error:e instanceof Error?e.message:'invalid domain'},400);}
 }
 if(url.pathname==='/rdap/domain'){
  const name=url.searchParams.get('name');if(!name)return json({ok:false,error:'name required'},400);
  try{return json(await rdapDomain(store,normalizeDomain(name)));}catch(e){return json({error:e instanceof Error?e.message:'not found'},404);}
 }
 if(url.pathname==='/domain/create'&&request.method==='POST'){
  if(env.REGISTRY_TOKEN_SHA256 && !(await bearerValid(request.headers.get('authorization')||undefined,env.REGISTRY_TOKEN_SHA256)))return json({ok:false,error:'unauthorized'},401);
  let body:{name?:string;registrarId?:string;registrantId?:string;nameservers?:string[]};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.name||!body.registrarId||!body.registrantId)return json({ok:false,error:'name, registrarId and registrantId required'},400);
  try{return json({ok:true,domain:await createDomain(store,{name:body.name,registrarId:body.registrarId,registrantId:body.registrantId,nameservers:body.nameservers||[],expiresAt:new Date(Date.now()+365*86400000).toISOString()},'api')},201);}
  catch(error){return json({ok:false,error:error instanceof Error?error.message:'create failed'},409);}
 }
 if(url.pathname==='/epp'&&request.method==='POST'){
  if(env.REGISTRY_TOKEN_SHA256 && !(await bearerValid(request.headers.get('authorization')||undefined,env.REGISTRY_TOKEN_SHA256)))return new Response('<epp><response><result code="2201"><msg>authorization error</msg></result></response></epp>',{status:401,headers:{'content-type':'application/epp+xml'}});
  return new Response(await eppHandle(store,await request.text()),{headers:{'content-type':'application/epp+xml; charset=utf-8'}});
 }
 return json({ok:false,error:'not found'},404);
}