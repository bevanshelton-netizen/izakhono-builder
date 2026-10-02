import {Domain,RegistryStore,RegistryAdapter,RdapProvider,DnsProvider,transitionDomain} from './core';
import {provisionDns} from './dns';
import {RegistrationOrder,RegistrationOrderStore,nextOrderState,transitionOrder} from './registration-order';

export type RegistrationResult={domain:Domain;authorityTransactionId:string;authorityConfirmed:boolean;dnsPublished:boolean;dnsVerified:boolean;rdapVerified:boolean;handedOver:boolean};

async function syncOrder(store:RegistrationOrderStore,order:RegistrationOrder,patch:Partial<RegistrationOrder>){
 const desired={...order,...patch,updatedAt:new Date().toISOString()};
 const next=desired.state===order.state ? desired : transitionOrder(order,desired.state,patch);
 await store.put(next);
 return next;
}

export async function registerAuthoritatively(store:RegistryStore,adapter:RegistryAdapter,dns:DnsProvider,domain:Domain,rdap?:RdapProvider,orders?:RegistrationOrderStore,orderId?:string):Promise<RegistrationResult>{
 const order=orders&&orderId?await orders.get(orderId):undefined;
 if(orders&&orderId&&!order) throw new Error('registration order not found');
 if(order&&order.domain!==domain.name) throw new Error('registration order domain mismatch');

 const available=await adapter.availability(domain.name);
 if(!available) throw new Error('domain unavailable at authoritative registry');

 const authority=await adapter.register(domain);
 if(authority.transactionId==='') throw new Error('authority transaction missing');
 if(!authority.confirmed) throw new Error('authority registration not confirmed');
 let current=order;
 if(current&&orders) current=await syncOrder(orders,current,{authorityTransactionId:authority.transactionId,authorityConfirmed:true});

 const dnsResult=await provisionDns(dns,domain.name,domain.nameservers);
 if(!dnsResult.published) throw new Error('DNS provisioning not confirmed');
 if(current&&orders) current=await syncOrder(orders,current,{dnsPublished:true});

 const dnsVerified=dns.verify ? await dns.verify(domain.name) : false;
 if(!dnsVerified) throw new Error('DNS verification not confirmed');
 if(current&&orders) current=await syncOrder(orders,current,{dnsVerified:true});

 const rdapVerified=rdap ? await rdap.verify(domain.name) : false;
 if(!rdapVerified) throw new Error('RDAP verification not confirmed');
 if(current&&orders) current=await syncOrder(orders,current,{rdapVerified:true});

 const live=await transitionDomain(store,domain.name,'ok','authority');
 if(current&&orders) await syncOrder(orders,current,{});
 return {domain:live,authorityTransactionId:authority.transactionId,authorityConfirmed:true,dnsPublished:true,dnsVerified,rdapVerified,handedOver:false};
}

export async function handoverVerifiedRegistration(result:RegistrationResult):Promise<RegistrationResult>{
 if(!result.authorityConfirmed||!result.dnsPublished||!result.dnsVerified||!result.rdapVerified) throw new Error('registration is not fully verified');
 if(result.domain.status!=='ok') throw new Error('domain is not active');
 return {...result,handedOver:true};
}

export async function handoverRegistrationOrder(orders:RegistrationOrderStore,orderId:string):Promise<RegistrationOrder>{
 const order=await orders.get(orderId);
 if(!order) throw new Error('registration order not found');
 if(nextOrderState(order)!=='readyForHandover') throw new Error('registration order is not ready for handover');
 const next=transitionOrder(order,'handedOver',{handedOver:true});
 await orders.put(next);
 return next;
}
