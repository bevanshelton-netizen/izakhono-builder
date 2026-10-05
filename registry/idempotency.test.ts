import {MemoryIdempotencyStore,hashRequest} from './idempotency';

(async () => {

  const store=new MemoryIdempotencyStore();
  const hash=await hashRequest({domain:'alpha.test'});
  const first=await store.claim('k1',hash,'t1');
  if(!first.claimed)throw new Error('initial idempotency claim failed');
  const concurrent=await store.claim('k1',hash,'t2');
  if(concurrent.claimed)throw new Error('concurrent idempotency claim was allowed');
  if(concurrent.record?.status!=='processing')throw new Error('processing state missing');
  await store.complete('k1',hash,{ok:true},'t3');
  const retry=await store.claim('k1',hash,'t4');
  if(retry.claimed||retry.record?.status!=='completed'||JSON.stringify(retry.record?.response)!==JSON.stringify({ok:true}))throw new Error('completed idempotency replay failed');
  const mismatchHash=await hashRequest({domain:'other.test'});
  const mismatch=await store.claim('k1',mismatchHash,'t5');
  if(mismatch.claimed||mismatch.record?.requestHash!==hash||mismatch.record?.requestHash===mismatchHash)throw new Error('idempotency hash mismatch was not detected');
  console.log('IZAKHONO idempotency tests passed');

} )();
