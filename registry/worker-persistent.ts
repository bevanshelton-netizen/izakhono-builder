import {registryFetch} from './api';
import {workerControl,pumpWorkers} from './worker-supervisor';
import {controlPlaneStatus} from './control-plane';
import {diagnoseControlPlane} from './control-plane-diagnostics';
import {bearerValid} from './security';
import {D1RegistryStore,D1Database} from './d1-store';
import {D1IdempotencyStore,D1IdempotencyDb} from './d1-idempotency';
import {D1RegistrarStore,D1RegistrarDb} from './d1-registrar-store';
import {D1RegistrationOrderStore} from './d1-registration-order';
import {NativeBuilderCore,systemBuilderClock,type RiskClass} from '../products/izakhono-native-builder/src/index';
import {D1BuilderStore} from '../products/izakhono-native-builder/src/d1-store';
interface Env{DB:D1Database;REGISTRY_TOKEN_SHA256?:string;QA_VERIFIER_TOKEN_SHA256?:string;FORTRESS_CAPABILITY_SECRET?:string;APP_ENV?:string}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
async function nativeBuilderFetch(request:Request,env:Env){
 const path=new URL(request.url).pathname;
 if(!env.REGISTRY_TOKEN_SHA256)return json({ok:false,error:'native builder API is disabled until REGISTRY_TOKEN_SHA256 is configured'},503);
 if(!await bearerValid(request.headers.get('authorization')||undefined,env.REGISTRY_TOKEN_SHA256))return json({ok:false,error:'unauthorized'},401);
 const core=new NativeBuilderCore(new D1BuilderStore(env.DB),systemBuilderClock);
 try{
  if(path==='/native-builder/projects'&&request.method==='POST'){
   const body=await request.json() as {id?:string;name?:string;description?:string;repository?:string;sourceOfTruth?:'izakhono_internal'|'git_mirror'|'external_pending_import';status?:'discovered'|'imported'|'editable'|'validated'|'release_candidate'|'deployed_owned'|'verified_owned'|'retired';dependencies?:string[]};
   if(!body.id||!body.name||!body.sourceOfTruth||!body.status)return json({ok:false,error:'id, name, sourceOfTruth and status are required'},400);
   const project=await core.registerProject({id:body.id,name:body.name,description:body.description??'',repository:body.repository,sourceOfTruth:body.sourceOfTruth,status:body.status,dependencies:body.dependencies??[]});
   return json({ok:true,project},201);
  }
  if(path.startsWith('/native-builder/projects/')&&request.method==='GET'){
   const id=decodeURIComponent(path.slice('/native-builder/projects/'.length));
   const project=await new D1BuilderStore(env.DB).getProject(id);
   return project?json({ok:true,project}):json({ok:false,error:'project not found'},404);
  }
  if(path==='/native-builder/jobs'&&request.method==='POST'){
   const body=await request.json() as {projectId?:string;instruction?:string;requestedBy?:string;risk?:RiskClass;productionRelease?:boolean};
   if(!body.projectId||!body.instruction||!body.requestedBy||!body.risk)return json({ok:false,error:'projectId, instruction, requestedBy and risk are required'},400);
   if(!['routine','sensitive','destructive','financial','external'].includes(body.risk))return json({ok:false,error:'invalid risk class'},400);
   const job=await core.requestBuild({projectId:body.projectId,instruction:body.instruction,requestedBy:body.requestedBy,risk:body.risk,productionRelease:body.productionRelease});
   return json({ok:true,job},202);
  }
  if(path.startsWith('/native-builder/jobs/')&&path.endsWith('/approve')&&request.method==='POST'){
   const id=decodeURIComponent(path.slice('/native-builder/jobs/'.length,-'/approve'.length));
   const body=await request.json() as {approver?:string};
   if(!body.approver)return json({ok:false,error:'approver is required'},400);
   const job=await core.approveJob(id,body.approver);
   return json({ok:true,job});
  }
  if(path.startsWith('/native-builder/jobs/')&&request.method==='GET'){
   const id=decodeURIComponent(path.slice('/native-builder/jobs/'.length));
   const job=await new D1BuilderStore(env.DB).getJob(id);
   return job?json({ok:true,job}):json({ok:false,error:'job not found'},404);
  }
  return json({ok:false,error:'not found'},404);
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  const status=message.includes('not found')?404:message.includes('already exists')?409:400;
  return json({ok:false,error:message},status);
 }
}
export default{async fetch(request:Request,env:Env){const authorized=Boolean(env.REGISTRY_TOKEN_SHA256)&&await bearerValid(request.headers.get('authorization')||undefined,env.REGISTRY_TOKEN_SHA256!);const verifierAuthorized=Boolean(env.QA_VERIFIER_TOKEN_SHA256)&&await bearerValid(request.headers.get('authorization')||undefined,env.QA_VERIFIER_TOKEN_SHA256!);const url=new URL(request.url);const path=url.pathname;if(path.startsWith('/native-builder/'))return nativeBuilderFetch(request,env);if(path==='/control-plane/status'){if(!authorized)return json({ok:false,error:'unauthorized'},401);return json({ok:true,...controlPlaneStatus()});}if(path==='/control-plane/diagnose'&&request.method==='GET'){if(!authorized)return json({ok:false,error:'unauthorized'},401);const domain=url.searchParams.get('domain');if(!domain)return json({ok:false,error:'domain required'},400);try{return json({ok:true,diagnostic:await diagnoseControlPlane(domain)});}catch(error){return json({ok:false,error:error instanceof Error?error.message:String(error)},400);}}if(path.startsWith('/workers/'))return workerControl(request,authorized,env.DB,verifierAuthorized,env.FORTRESS_CAPABILITY_SECRET);const store=new D1RegistryStore(env.DB);const idempotency=new D1IdempotencyStore(env.DB as D1IdempotencyDb);const registrars=new D1RegistrarStore(env.DB as D1RegistrarDb);const orders=new D1RegistrationOrderStore(env.DB);return registryFetch(request,store,env,idempotency,registrars,orders);},async scheduled(_event:unknown,env:Env){await pumpWorkers(env.DB,env.FORTRESS_CAPABILITY_SECRET);}};
