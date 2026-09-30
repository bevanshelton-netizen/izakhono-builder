import {IdempotencyRecord,IdempotencyStore} from './idempotency';

export interface D1IdempotencyDb{prepare(sql:string):{bind(...values:unknown[]):{first<T=unknown>():Promise<T|null>;run():Promise<unknown>}}}
export class D1IdempotencyStore implements IdempotencyStore{
 constructor(private db:D1IdempotencyDb){}
 async get(key:string){
  const r=await this.db.prepare('SELECT * FROM idempotency_keys WHERE key=?').bind(key).first<Record<string,unknown>>();
  if(!r)return undefined;
  return {key:String(r.key),requestHash:String(r.request_hash),response:JSON.parse(String(r.response_json)),createdAt:String(r.created_at)};
 }
 async put(record:IdempotencyRecord){
  await this.db.prepare('INSERT INTO idempotency_keys(key,actor,request_hash,response_json,created_at) VALUES(?,?,?,?,?) ON CONFLICT(key) DO NOTHING').bind(record.key,'api',record.requestHash,JSON.stringify(record.response),record.createdAt).run();
 }
}
