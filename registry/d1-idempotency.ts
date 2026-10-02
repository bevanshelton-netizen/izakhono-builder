import {IdempotencyRecord,IdempotencyStore,IdempotencyClaim} from './idempotency';

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
 async claim(key:string,requestHash:string,createdAt:string){
  const inserted=await this.db.prepare('INSERT OR IGNORE INTO idempotency_claims(key,request_hash,status,created_at) VALUES(?,?,?,?)').bind(key,requestHash,'processing',createdAt).run();
  const existing=await this.db.prepare('SELECT * FROM idempotency_claims WHERE key=?').bind(key).first<Record<string,unknown>>();
  const changes=Number((inserted as {meta?:{changes?:number}})?.meta?.changes||0);
  const claimed=changes===1;
  if(!existing)return {claimed};
  const record:IdempotencyClaim={key:String(existing.key),requestHash:String(existing.request_hash),status:String(existing.status)==='completed'?'completed':'processing',response:existing.response_json?JSON.parse(String(existing.response_json)):undefined,createdAt:String(existing.created_at),completedAt:existing.completed_at?String(existing.completed_at):undefined};
  return {claimed,record};
 }
 async complete(key:string,requestHash:string,response:unknown,completedAt:string){
  const result=await this.db.prepare('UPDATE idempotency_claims SET status=?,response_json=?,completed_at=? WHERE key=? AND request_hash=? AND status=?').bind('completed',JSON.stringify(response),completedAt,key,requestHash,'processing').run();
  const changes=Number((result as {meta?:{changes?:number}})?.meta?.changes||0);
  if(changes!==1)throw new Error('idempotency claim mismatch or already completed');
  await this.put({key,requestHash,response,createdAt:completedAt});
 }
}
