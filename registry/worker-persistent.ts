import {registryFetch} from './api';
import {D1RegistryStore,D1Database} from './d1-store';
interface Env{DB:D1Database;REGISTRY_TOKEN_SHA256?:string;APP_ENV?:string}
export default{async fetch(request:Request,env:Env){return registryFetch(request,new D1RegistryStore(env.DB),env);}};