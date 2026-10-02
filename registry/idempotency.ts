import { sha256 } from './security';

export type IdempotencyRecord={key:string;requestHash:string;response:unknown;createdAt:string};
export type IdempotencyClaim={key:string;requestHash:string;status:'processing'|'completed';response?:unknown;createdAt:string;completedAt?:string};
export interface IdempotencyStore{
  get(key:string):Promise<IdempotencyRecord|undefined>;
  put(record:IdempotencyRecord):Promise<void>;
  claim?(key:string,requestHash:string,createdAt:string):Promise<{claimed:boolean;record?:IdempotencyClaim}>;
  complete?(key:string,requestHash:string,response:unknown,completedAt:string):Promise<void>;
}
export class MemoryIdempotencyStore implements IdempotencyStore{
 private records=new Map<string,IdempotencyRecord>();
 private claims=new Map<string,IdempotencyClaim>();
 async get(key:string){return this.records.get(key)}
 async put(record:IdempotencyRecord){this.records.set(record.key,record);this.claims.set(record.key,{key:record.key,requestHash:record.requestHash,status:'completed',response:record.response,createdAt:record.createdAt,completedAt:record.createdAt});}
 async claim(key:string,requestHash:string,createdAt:string){
  const existing=this.claims.get(key);
  if(existing)return {claimed:false,record:existing};
  const record={key,requestHash,status:'processing' as const,createdAt};
  this.claims.set(key,record);
  return {claimed:true,record};
 }
 async complete(key:string,requestHash:string,response:unknown,completedAt:string){
  const existing=this.claims.get(key);
  if(!existing||existing.requestHash!==requestHash)throw new Error('idempotency claim mismatch');
  if(existing.status==='completed')return;
  this.claims.set(key,{...existing,status:'completed',response,completedAt});
  this.records.set(key,{key,requestHash,response,createdAt:existing.createdAt});
 }
}
export async function hashRequest(payload:unknown){return sha256(JSON.stringify(payload));}
