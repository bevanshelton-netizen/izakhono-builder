import { sha256 } from './security';

export type IdempotencyRecord={key:string;requestHash:string;response:unknown;createdAt:string};
export class MemoryIdempotencyStore{
 private records=new Map<string,IdempotencyRecord>();
 get(key:string){return this.records.get(key)}
 put(key:string,response:unknown,payload:unknown){
  const requestHash=sha256(JSON.stringify(payload));
  const record={key,requestHash,response,createdAt:new Date().toISOString()};
  this.records.set(key,record); return record;
 }
}
