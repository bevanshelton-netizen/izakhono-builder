import {RegistryStore,Domain,Contact,Host,AuditEvent} from './core';

export interface D1Statement{bind(...values:unknown[]):D1Statement;first<T=unknown>():Promise<T|null>;run():Promise<unknown>;}
export interface D1Database{prepare(sql:string):D1Statement;}

export class D1RegistryStore implements RegistryStore{
  constructor(private db:D1Database){}
  async getDomain(name:string){const r=await this.db.prepare('SELECT * FROM domains WHERE name=?').bind(name).first<Record<string,unknown>>();return r?this.domain(r):undefined;}
  async putDomain(d:Domain){await this.db.prepare('INSERT INTO domains(name,registrar_id,registrant_id,nameservers_json,status,created_at,updated_at,expires_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET registrar_id=excluded.registrar_id,registrant_id=excluded.registrant_id,nameservers_json=excluded.nameservers_json,status=excluded.status,updated_at=excluded.updated_at,expires_at=excluded.expires_at').bind(d.name,d.registrarId,d.registrantId,JSON.stringify(d.nameservers),d.status,d.createdAt,d.updatedAt,d.expiresAt).run();}
  async getContact(id:string){const r=await this.db.prepare('SELECT * FROM contacts WHERE id=?').bind(id).first<Record<string,unknown>>();return r?{id:String(r.id),name:String(r.name),email:String(r.email),organization:r.organization?String(r.organization):undefined,country:r.country?String(r.country):undefined}:undefined;}
  async putContact(c:Contact){await this.db.prepare('INSERT INTO contacts(id,name,email,organization,country,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,organization=excluded.organization,country=excluded.country').bind(c.id,c.name,c.email,c.organization||null,c.country||null,new Date().toISOString()).run();}
  async getHost(name:string){const r=await this.db.prepare('SELECT * FROM hosts WHERE name=?').bind(name).first<Record<string,unknown>>();return r?{name:String(r.name),addresses:JSON.parse(String(r.addresses_json))}:undefined;}
  async putHost(h:Host){await this.db.prepare('INSERT INTO hosts(name,addresses_json,created_at) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET addresses_json=excluded.addresses_json').bind(h.name,JSON.stringify(h.addresses),new Date().toISOString()).run();}
  async audit(e:AuditEvent){await this.db.prepare('INSERT INTO audit_events(id,at,actor,action,object_type,object_id,before_json,after_json) VALUES(?,?,?,?,?,?,?,?)').bind(e.id,e.at,e.actor,e.action,e.objectType,e.objectId,e.before===undefined?null:JSON.stringify(e.before),e.after===undefined?null:JSON.stringify(e.after)).run();}
  private domain(r:Record<string,unknown>):Domain{return{name:String(r.name),registrarId:String(r.registrar_id),registrantId:String(r.registrant_id),nameservers:JSON.parse(String(r.nameservers_json||'[]')),status:r.status as Domain['status'],createdAt:String(r.created_at),updatedAt:String(r.updated_at),expiresAt:String(r.expires_at)}}
}