import {MemoryRegistrationOrderStore,nextOrderState,transitionOrder} from './registration-order';

(async () => {
  const store=new MemoryRegistrationOrderStore();
  const base={id:'o1',domain:'alpha.izt',registrarId:'r',state:'pending' as const,authorityConfirmed:false,dnsPublished:false,dnsVerified:false,rdapVerified:false,handedOver:false,createdAt:'x',updatedAt:'x'};
  if(nextOrderState(base)!=='pending')throw new Error('pending state failed');
  const ready={...base,authorityConfirmed:true,dnsPublished:true,dnsVerified:true,rdapVerified:true};
  if(nextOrderState(ready)!=='readyForHandover')throw new Error('ready state failed');
  const done={...ready,handedOver:true};
  if(nextOrderState(done)!=='handedOver')throw new Error('handover state failed');
  await store.put(done);
  if(!(await store.get('o1'))?.handedOver)throw new Error('order store failed');
  if((await store.listByDomain('alpha.izt')).length!==1)throw new Error('domain listing failed');

  const authority=transitionOrder(base,'authorityConfirmed',{authorityConfirmed:true});
  if(authority.state!=='authorityConfirmed')throw new Error('authority transition failed');
  let invalid=false;try{transitionOrder(base,'readyForHandover',{authorityConfirmed:true,dnsPublished:true,dnsVerified:true,rdapVerified:true});}catch{invalid=true}
  if(!invalid)throw new Error('invalid order transition was allowed');
  console.log('IZAKHONO registration order tests passed');

} )();
