export type RegistrationOrderState='pending'|'authorityConfirmed'|'dnsPublished'|'dnsVerified'|'rdapVerified'|'readyForHandover'|'handedOver';
export type RegistrationOrder={id:string;domain:string;registrarId:string;customerReference?:string;state:RegistrationOrderState;authorityTransactionId?:string;authorityConfirmed:boolean;dnsPublished:boolean;dnsVerified:boolean;rdapVerified:boolean;handedOver:boolean;createdAt:string;updatedAt:string};
export interface RegistrationOrderStore{get(id:string):Promise<RegistrationOrder|undefined>;put(order:RegistrationOrder):Promise<void>;listByDomain(domain:string):Promise<RegistrationOrder[]>}
export class MemoryRegistrationOrderStore implements RegistrationOrderStore{
 private items=new Map<string,RegistrationOrder>();
 async get(id:string){return this.items.get(id)}
 async put(order:RegistrationOrder){this.items.set(order.id,order)}
 async listByDomain(domain:string){return [...this.items.values()].filter(x=>x.domain===domain)}
}
export function nextOrderState(order:RegistrationOrder):RegistrationOrderState{
 if(order.handedOver)return 'handedOver';
 if(order.authorityConfirmed&&order.dnsPublished&&order.dnsVerified&&order.rdapVerified)return 'readyForHandover';
 if(order.rdapVerified)return 'rdapVerified';
 if(order.dnsVerified)return 'dnsVerified';
 if(order.dnsPublished)return 'dnsPublished';
 if(order.authorityConfirmed)return 'authorityConfirmed';
 return 'pending';
}