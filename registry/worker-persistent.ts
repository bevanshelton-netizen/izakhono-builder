import {registryFetch} from './api';
import {workerControl} from './worker-supervisor';
import {bearerValid} from './security';
import {D1RegistryStore,D1Database} from './d1-store';
import {D1IdempotencyStore,D1IdempotencyDb} from './d1-idempotency';
import {D1RegistrarStore,D1RegistrarDb} from './d1-registrar-store';
import {D1RegistrationOrderStore} from './d1-registration-order';
interface Env{DB:D1Database;REGISTRY_TOKEN_SHA256?:string;APP_ENV?:string}
export default{async fetch(request:Request,env:Env){const authorized=!env.REGISTRY_TOKEN_SHA256||await bearerValid(request.headers.get('authorization')||undefined,env.REGISTRY_TOKEN_SHA256);if(new URL(request.url).pathname.startsWith('/workers/'))return workerControl(request,authorized,env.DB);const store=new D1RegistryStore(env.DB);const idempotency=new D1IdempotencyStore(env.DB as D1IdempotencyDb);const registrars=new D1RegistrarStore(env.DB as D1RegistrarDb);const orders=new D1RegistrationOrderStore(env.DB);return registryFetch(request,store,env,idempotency,registrars,orders);}};
