import {RegistrationOrder,RegistrationOrderStore} from './registration-order';
import {D1Database} from './d1-store';
export class D1RegistrationOrderStore implements RegistrationOrderStore{
 constructor(private db:D1Database){}
 async get(id:string){
  const r=await this.db.prepare('SELECT * FROM registration_orders WHERE id=?').bind(id).first<Record<string,unknown>>();
  return r?this.order(r):undefined;
 }
 async put(o:RegistrationOrder){
  await this.db.prepare('INSERT INTO registration_orders(id,domain,registrar_id,customer_reference,state,authority_transaction_id,authority_confirmed,dns_published,dns_verified,rdap_verified,handed_over,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET domain=excluded.domain,registrar_id=excluded.registrar_id,customer_reference=excluded.customer_reference,state=excluded.state,authority_transaction_id=excluded.authority_transaction_id,authority_confirmed=excluded.authority_confirmed,dns_published=excluded.dns_published,dns_verified=excluded.dns_verified,rdap_verified=excluded.rdap_verified,handed_over=excluded.handed_over,updated_at=excluded.updated_at')
   .bind(o.id,o.domain,o.registrarId,o.customerReference||null,o.state,o.authorityTransactionId||null,o.authorityConfirmed?1:0,o.dnsPublished?1:0,o.dnsVerified?1:0,o.rdapVerified?1:0,o.handedOver?1:0,o.createdAt,o.updatedAt).run();
 }
 async listByDomain(domain:string){
  const r=await this.db.prepare('SELECT * FROM registration_orders WHERE domain=? ORDER BY created_at DESC').bind(domain).all<Record<string,unknown>>();
  return r.results.map(x=>this.order(x));
 }
 private order(r:Record<string,unknown>):RegistrationOrder{return{id:String(r.id),domain:String(r.domain),registrarId:String(r.registrar_id),customerReference:r.customer_reference?String(r.customer_reference):undefined,state:r.state as RegistrationOrder['state'],authorityTransactionId:r.authority_transaction_id?String(r.authority_transaction_id):undefined,authorityConfirmed:Number(r.authority_confirmed)===1,dnsPublished:Number(r.dns_published)===1,dnsVerified:Number(r.dns_verified)===1,rdapVerified:Number(r.rdap_verified)===1,handedOver:Number(r.handed_over)===1,createdAt:String(r.created_at),updatedAt:String(r.updated_at)}}
}
