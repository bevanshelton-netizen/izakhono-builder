import { sha256 } from './security';

export type IdempotencyRecord={key:string;requestHash:string;response:unknown;createdAt:string};
export interface IdempotencyStore{get(key:string):Promise<IdempotencyRecord|undefined>;put(record:IdempotencyRecord):Promise<void>;}
export class MemoryIdempotencyStore implements IdempotencyStore{
 private records=new Map<string,IdempotencyRecord>();
 async get(key:string){return this.records.get(key)}
 async put(record:IdempotencyRecord){this.records.set(record.key,record)}
}
export async function hashRequest(payload:unknown){return sha256(JSON.stringify(payload));}
