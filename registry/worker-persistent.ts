import {registryFetch} from './api';
import {workerControl} from './worker-supervisor';
import {controlPlaneStatus} from './control-plane';
import {diagnoseControlPlane} from './control-plane-diagnostics';
import {bearerValid} from './security';
import {D1RegistryStore,D1Database} from './d1-store';
import {D1IdempotencyStore,D1IdempotencyDb} from './d1-idempotency';
import {D1RegistrarStore,D1RegistrarDb} from './d1-registrar-store';
import {D1RegistrationOrderStore} from './d1-registration-order';
interface Env{DB:D1Database;REGISTRY_TOKEN_SHA256?:string;APP_ENV?:string}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export default{async fetch(request:Request,env:Env){const authorized=!env.REGISTRY_TOKEN_SHA256||await bearerValid(request.headers.get('authorization')||undefined,env.REGISTRY_TOKEN_SHA256);const url=new URL(request.url);const path=url.pathname;if(path==='/control-plane/status'){if(!authorized)return json({ok:false,error:'unauthorized'},401);return json({ok:true,...controlPlaneStatus()});}if(path==='/control-plane/diagnose'&&request.method==='GET'){if(!authorized)return json({ok:false,error:'unauthorized'},401);const domain=url.searchParams.get('domain');if(!domain)return json({ok:false,error:'domain required'},400);try{return json({ok:true,diagnostic:await diagnoseControlPlane(domain)});}catch(error){return json({ok:false,error:error instanceof Error?error.message:String(error)},400);}}if(path.startsWith('/workers/'))return workerControl(request,authorized,env.DB);const store=new D1RegistryStore(env.DB);const idempotency=new D1IdempotencyStore(env.DB as D1IdempotencyDb);const registrars=new D1RegistrarStore(env.DB as D1RegistrarDb);const orders=new D1RegistrationOrderStore(env.DB);return registryFetch(request,store,env,idempotency,registrars,orders);}};
