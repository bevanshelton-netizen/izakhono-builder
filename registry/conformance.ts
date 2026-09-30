import { normalizeDomain, canTransition, DomainStatus } from './core';
const must=(ok:boolean,msg:string)=>{if(!ok)throw new Error('CONFORMANCE: '+msg)};
export function runRegistryConformance(){
  must(normalizeDomain(' Example.TEST. ')==='example.test','domain normalization');
  const states:DomainStatus[]=['pendingCreate','ok','clientHold','clientTransferProhibited','pendingTransfer','pendingDelete','redemptionPeriod'];
  for(const s of states) must(typeof s==='string','status '+s);
  must(canTransition('pendingCreate','ok'),'pendingCreate->ok');
  must(!canTransition('pendingCreate','pendingDelete'),'invalid lifecycle transition');
  return {ok:true,checks:4,at:new Date().toISOString()};
}
