export type RegistrationOrderState='pending'|'authorityConfirmed'|'dnsPublished'|'dnsVerified'|'rdapVerified'|'readyForHandover'|'handedOver';
export type RegistrationOrder={id:string;domain:string;registrarId:string;customerReference?:string;state:RegistrationOrderState;authorityTransactionId?:string;authorityConfirmed:boolean;dnsPublished:boolean;dnsVerified:boolean;rdapVerified:boolean;handedOver:boolean;createdAt:string;updatedAt:string};
export interface RegistrationOrderStore{get(id:string):Promise<RegistrationOrder|undefined>;put(order:RegistrationOrder):Promise<void>;listByDomain(domain:string):Promise<RegistrationOrder[]>}
export class MemoryRegistrationOrderStore implements RegistrationOrderStore{
 private items=new Map<string,RegistrationOrder>();
 async get(id:string){return this.items.get(id)}
 async put(order:RegistrationOrder){this.items.set(order.id,order)}
 async listByDomain(domain:string){return [...this.items.values()].filter(x=>x.domain===domain)}
}
const sequence:RegistrationOrderState[]=['pending','authorityConfirmed','dnsPublished','dnsVerified','rdapVerified','readyForHandover','handedOver'];
export function nextOrderState(order:RegistrationOrder):RegistrationOrderState{
 if(order.handedOver)return 'handedOver';
 if(order.authorityConfirmed&&order.dnsPublished&&order.dnsVerified&&order.rdapVerified)return 'readyForHandover';
 if(order.rdapVerified)return 'rdapVerified';
 if(order.dnsVerified)return 'dnsVerified';
 if(order.dnsPublished)return 'dnsPublished';
 if(order.authorityConfirmed)return 'authorityConfirmed';
 return 'pending';
}
export function assertOrderTransition(from:RegistrationOrderState,to:RegistrationOrderState){
 const i=sequence.indexOf(from),j=sequence.indexOf(to);
 if(j!==i+1)throw new Error('invalid registration order transition: '+from+' -> '+to);
}
export function transitionOrder(order:RegistrationOrder,to:RegistrationOrderState,patch:Partial<RegistrationOrder>={}):RegistrationOrder{
 if(order.state===to)return order;
 assertOrderTransition(order.state,to);
 const next={...order,...patch,state:to,updatedAt:new Date().toISOString()};
 if(nextOrderState(next)!==to)throw new Error('registration order flags do not justify state '+to);
 return next;
}
