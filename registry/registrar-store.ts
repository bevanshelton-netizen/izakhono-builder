import { Registrar } from './registrar';

export interface RegistrarStore {
  get(id:string): Promise<Registrar|undefined>;
  put(registrar:Registrar): Promise<void>;
}

export class MemoryRegistrarStore implements RegistrarStore {
  private items=new Map<string,Registrar>();
  async get(id:string){ return this.items.get(id); }
  async put(registrar:Registrar){ this.items.set(registrar.id, registrar); }
}
