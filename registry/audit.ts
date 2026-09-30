export type AuditEvent={id:string;at:string;actor:string;action:string;objectType:string;objectId:string;before?:unknown;after?:unknown};
export class MemoryAuditLog{
 readonly events:AuditEvent[]=[];
 append(event:Omit<AuditEvent,'id'|'at'>){const item={...event,id:'audit-'+crypto.randomUUID(),at:new Date().toISOString()};this.events.push(item);return item;}
 list(objectType?:string,objectId?:string){return this.events.filter(e=>(!objectType||e.objectType===objectType)&&(!objectId||e.objectId===objectId));}
}
