import {MemoryRegistryStore} from './memory-store';
import {createDomain} from './core';
import {handoverVerifiedRegistration,registerAuthoritatively} from './transaction';
import {MemoryRegistrationOrderStore} from './registration-order';

(async () => {

  const store=new MemoryRegistryStore();
  const orders=new MemoryRegistrationOrderStore();
  const now=()=>new Date(Date.now()+86400000).toISOString();
  await orders.put({id:'order-1',domain:'tx.test',registrarId:'r',state:'pending',authorityConfirmed:false,dnsPublished:false,dnsVerified:false,rdapVerified:false,handedOver:false,createdAt:now(),updatedAt:now()});
  const domain=await createDomain(store,{name:'tx.test',registrarId:'r',registrantId:'c',nameservers:['ns1.test'],expiresAt:now()},'test');
  const result=await registerAuthoritatively(store,{availability:async()=>true,register:async()=>({transactionId:'authority-1',confirmed:true}),renew:async()=>({transactionId:'renew-1',expiresAt:'x'}),transfer:async()=>({transactionId:'transfer-1'})},{publish:async()=>{},remove:async()=>{},verify:async()=>true},domain,{verify:async()=>true},orders,'order-1');
  if(result.domain.status!=='ok'||!result.authorityConfirmed||!result.dnsPublished||!result.dnsVerified||!result.rdapVerified||result.handedOver) throw new Error('registration transaction contract failed');
  const order=await orders.get('order-1');
  if(!order||order.state!=='readyForHandover'||!order.authorityConfirmed||!order.dnsPublished||!order.dnsVerified||!order.rdapVerified) throw new Error('order did not reach readyForHandover');
  const handedOver=await handoverVerifiedRegistration(result);
  if(!handedOver.handedOver) throw new Error('verified registration handover failed');
  let blocked=false;
  try{await handoverVerifiedRegistration({...result,dnsVerified:false});}catch{blocked=true}
  if(!blocked) throw new Error('unverified registration handover was allowed');
  console.log('IZAKHONO transaction tests passed');

} )();
