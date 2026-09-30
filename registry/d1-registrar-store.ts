import { Registrar } from './registrar';
import { RegistrarStore } from './registrar-store';

export interface D1RegistrarDb {
  prepare(sql:string): {
    bind(...values:unknown[]): {
      first<T=unknown>():Promise<T|null>;
      run():Promise<unknown>;
    };
  };
}

export class D1RegistrarStore implements RegistrarStore {
  constructor(private db:D1RegistrarDb){}
  async get(id:string){
    const r=await this.db.prepare('SELECT * FROM registrars WHERE id=?').bind(id).first<Record<string,unknown>>();
    return r ? {id:String(r.id),name:String(r.name),status:r.status as Registrar['status'],createdAt:String(r.created_at)} : undefined;
  }
  async put(registrar:Registrar){
    await this.db.prepare('INSERT INTO registrars(id,name,status,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,status=excluded.status').bind(registrar.id,registrar.name,registrar.status,registrar.createdAt).run();
  }
}
