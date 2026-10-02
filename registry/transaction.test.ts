import {MemoryRegistryStore} from './memory-store';
import {createDomain} from './core';
import {handoverVerifiedRegistration,registerAuthoritatively} from './transaction';

const store=new MemoryRegistryStore();
const domain=await createDomain(store,{name:'tx.test',registrarId:'r',registrantId:'c',nameservers:['ns1.test'],expiresAt:new Date(Date.now()+86400000).toISOString()},'test');
const result=await registerAuthoritatively(store,{availability:async()=>true,register:async()=>({transactionId:'authority-1',confirmed:true}),renew:async()=>({transactionId:'renew-1',expiresAt:'x'}),transfer:async()=>({transactionId:'transfer-1'})},{publish:async()=>{},remove:async()=>{},verify:async()=>true},domain,{verify:async()=>true});
if(result.domain.status!=='ok'||!result.authorityConfirmed||!result.dnsPublished||!result.dnsVerified||!result.rdapVerified||result.handedOver) throw new Error('registration transaction contract failed');
const handedOver=handoverVerifiedRegistration(result);
if(!handedOver.handedOver) throw new Error('verified registration handover failed');
let blocked=false;
try{handoverVerifiedRegistration({...result,dnsVerified:false});}catch{blocked=true}
if(!blocked) throw new Error('unverified registration handover was allowed');
console.log('IZAKHONO transaction tests passed');

import {MemoryRegistrationOrderStore} from './registration-order';
const orders=new MemoryRegistrationOrderStore();
await orders.put({id:'order-1',domain:'tx.test',registrarId:'r',state:'pending',authorityConfirmed:false,dnsPublished:false,dnsVerified:false,rdapVerified:false,handedOver:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
const store2=new MemoryRegistryStore();
const domain2=await createDomain(store2,{name:'tx2.test',registrarId:'r',registrantId:'c',nameservers:['ns1.test'],expiresAt:new Date(Date.now()+86400000).toISOString()},'test');
const result2=await registerAuthoritatively(store2,{availability:async()=>true,register:async()=>({transactionId:'authority-2',confirmed:true}),renew:async()=>({transactionId:'renew-2',expiresAt:'x'}),transfer:async()=>({transactionId:'transfer-2'})},{publish:async()=>{},remove:async()=>{},verify:async()=>true},{verify:async()=>true},orders,'order-1').catch(e=>e);
if(!(result2 instanceof Error)) throw new Error('order/domain mismatch should fail');
const order=await orders.get('order-1');
if(!order||order.state!=='pending') throw new Error('order changed unexpectedly');
console.log('IZAKHONO order synchronization guard passed');
