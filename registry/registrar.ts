export type Registrar={id:string;name:string;status:'active'|'suspended';createdAt:string};
export class MemoryRegistrarStore{
 private items=new Map<string,Registrar>();
 create(id:string,name:string){const item={id,name,status:'active' as const,createdAt:new Date().toISOString()};this.items.set(id,item);return item;}
 get(id:string){return this.items.get(id)}
 suspend(id:string){const r=this.items.get(id);if(!r)throw new Error('registrar not found');const next={...r,status:'suspended' as const};this.items.set(id,next);return next;}
}
