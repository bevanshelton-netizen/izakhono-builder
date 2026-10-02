import {normalizeDomain,createDomain,RegistryStore,transitionDomain,DomainStatus} from './core';
import {MemoryRegistryStore} from './memory-store';
import {rdapDomain} from './rdap';
import {eppHandle} from './epp-server';
import {bearerValid} from './security';
import {hashRequest,IdempotencyStore,MemoryIdempotencyStore} from './idempotency';
import {Registrar} from './registrar';
import {RegistrarStore,MemoryRegistrarStore} from './registrar-store';

const memory=new MemoryRegistryStore();
const memoryIdempotency=new MemoryIdempotencyStore();
const memoryRegistrars=new MemoryRegistrarStore();
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export interface RegistryEnv{REGISTRY_TOKEN_SHA256?:string;APP_ENV?:string}
async function auth(request:Request,env:RegistryEnv){return !env.REGISTRY_TOKEN_SHA256 || await bearerValid(request.headers.get('authorization')||undefined,env.REGISTRY_TOKEN_SHA256)}
export async function registryFetch(request:Request,store:RegistryStore=memory,env:RegistryEnv={},idempotency:IdempotencyStore=memoryIdempotency,registrars:RegistrarStore=memoryRegistrars){
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
 if(url.pathname==='/registrar/create'&&request.method==='POST'){
  if(!(await auth(request,env)))return json({ok:false,error:'unauthorized'},401);
  let body:{id?:string;name?:string};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.id||!body.name)return json({ok:false,error:'id and name required'},400);
  if(await registrars.get(body.id))return json({ok:false,error:'registrar exists'},409);
  const registrar:Registrar={id:body.id.trim(),name:body.name.trim(),status:'active',createdAt:new Date().toISOString()};
  await registrars.put(registrar);return json({ok:true,registrar},201);
 }
 if(url.pathname==='/domain/create'&&request.method==='POST'){
  if(!(await auth(request,env)))return json({ok:false,error:'unauthorized'},401);
  const key=request.headers.get('idempotency-key')?.trim();if(!key||key.length>128)return json({ok:false,error:'Idempotency-Key header required'},400);
  let body:{name?:string;registrarId?:string;registrantId?:string;nameservers?:string[]};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  const requestHash=await hashRequest(body),prior=await idempotency.get(key);
  if(prior){if(prior.requestHash!==requestHash)return json({ok:false,error:'idempotency key reused with different request'},409);return json(prior.response,200);}
  if(!body.name||!body.registrarId||!body.registrantId)return json({ok:false,error:'name, registrarId and registrantId required'},400);
  const registrar=await registrars.get(body.registrarId);
  if(!registrar)return json({ok:false,error:'unknown registrar'},403);
  if(registrar.status!=='active')return json({ok:false,error:'registrar suspended'},403);
  try{
   const response={ok:true,domain:await createDomain(store,{name:body.name,registrarId:body.registrarId,registrantId:body.registrantId,nameservers:body.nameservers||[],expiresAt:new Date(Date.now()+365*86400000).toISOString()},'api')};
   await idempotency.put({key,requestHash,response,createdAt:new Date().toISOString()}); return json(response,201);
  }catch(error){return json({ok:false,error:error instanceof Error?error.message:'create failed'},409);}
 }
 if(url.pathname==='/domain/transition'&&request.method==='POST'){
  if(!(await auth(request,env)))return json({ok:false,error:'unauthorized'},401);
  let body:{name?:string;status?:DomainStatus};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.name||!body.status)return json({ok:false,error:'name and status required'},400);
  if(body.status==='ok')return json({ok:false,error:'direct transition to ok is disabled; use the authoritative registration transaction'},409);
  try{return json({ok:true,domain:await transitionDomain(store,body.name,body.status,'api')});}catch(e){return json({ok:false,error:e instanceof Error?e.message:'transition failed'},409);}
 }
 if(url.pathname==='/epp'&&request.method==='POST'){
  if(env.REGISTRY_TOKEN_SHA256 && !(await bearerValid(request.headers.get('authorization')||undefined,env.REGISTRY_TOKEN_SHA256)))return new Response('<epp><response><result code="2201"><msg>authorization error</msg></result></response></epp>',{status:401,headers:{'content-type':'application/epp+xml'}});
  const registrarId=request.headers.get('x-registrar-id')?.trim();
  if(!registrarId)return new Response('<epp><response><result code="2201"><msg>registrar identity required</msg></result></response></epp>',{status:401,headers:{'content-type':'application/epp+xml'}});
  const registrar=await registrars.get(registrarId);
  if(!registrar||registrar.status!=='active')return new Response('<epp><response><result code="2201"><msg>registrar not active</msg></result></response></epp>',{status:403,headers:{'content-type':'application/epp+xml'}});
  return new Response(await eppHandle(store,await request.text(),{registrarId,registrantId:`${registrarId}:registrant`}),{headers:{'content-type':'application/epp+xml; charset=utf-8'}});
 }
 return json({ok:false,error:'not found'},404);
}
