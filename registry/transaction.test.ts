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
