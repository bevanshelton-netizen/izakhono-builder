import {registryFetch} from './api';
import {D1RegistryStore,D1Database} from './d1-store';
import {D1IdempotencyStore,D1IdempotencyDb} from './d1-idempotency';
interface Env{DB:D1Database;REGISTRY_TOKEN_SHA256?:string;APP_ENV?:string}
export default{async fetch(request:Request,env:Env){
 const store=new D1RegistryStore(env.DB);
 const idempotency=new D1IdempotencyStore(env.DB as D1IdempotencyDb);
 return registryFetch(request,store,env,idempotency);
}};