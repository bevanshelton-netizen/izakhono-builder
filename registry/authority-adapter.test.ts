import {ExternalRegistryAdapter} from './authority-adapter';

(async () => {

  const calls:string[]=[];
  const adapter=new ExternalRegistryAdapter({
   check:async(name)=>{calls.push('check:'+name);return true},
   register:async(d)=>({transactionId:'tx-1',status:'confirmed',expiresAt:d.expiresAt}),
   renew:async(name)=>({transactionId:'tx-2',status:'confirmed'}),
   transfer:async(name)=>({transactionId:'tx-3',status:'submitted'})
  });
  if(!(await adapter.availability('Example.TEST'))) throw new Error('authority check failed');
  if((await adapter.register({name:'Example.TEST',registrarId:'r',registrantId:'c',nameservers:[],status:'pendingCreate',createdAt:'x',updatedAt:'x',expiresAt:'y'})).transactionId!=='tx-1') throw new Error('authority register failed');
  if(calls[0]!=='check:example.test') throw new Error('domain normalization failed');
  console.log('IZAKHONO authority adapter tests passed');

} )();
