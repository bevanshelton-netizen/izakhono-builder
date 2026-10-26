export const ACTIVATION_GATES = ['releaseApproved','health','deployment','edge','tls','dns','smokeTest','rollbackReady'] as const;
export type ActivationGate = typeof ACTIVATION_GATES[number];
export type ControlPlaneState = 'RELEASE_APPROVED'|'NODE_SELECTED'|'NODE_PROVISIONED'|'NODE_HEALTHY'|'RELEASE_DEPLOYED'|'EDGE_READY'|'TLS_READY'|'DNS_READY'|'SMOKE_TEST_PASSED'|'LIVE_VERIFIED'|'DEGRADED'|'FAILED'|'FAILED_OVER'|'ROLLBACK_READY';

export interface ControlPlaneEvidence extends Record<ActivationGate, boolean> {}
export interface ControlPlaneRecord {
  schemaVersion:'1.0'; release:string; orderId:string; target:{nodeId:string; routeClass:'owned'|'external-resilience'|'external-auxiliary'}; state:ControlPlaneState; evidence:ControlPlaneEvidence; updatedAt:string; failureReason?:string;
}

export function emptyEvidence():ControlPlaneEvidence {
  return {releaseApproved:false,health:false,deployment:false,edge:false,tls:false,dns:false,smokeTest:false,rollbackReady:false};
}

export function createControlPlaneRecord(input:{release:string;orderId:string;nodeId:string;routeClass:ControlPlaneRecord['target']['routeClass'];now?:string}):ControlPlaneRecord {
  if(!input.release.trim() || !input.orderId.trim() || !input.nodeId.trim()) throw new Error('release, orderId and nodeId are required');
  return {schemaVersion:'1.0',release:input.release,orderId:input.orderId,target:{nodeId:input.nodeId,routeClass:input.routeClass},state:'RELEASE_APPROVED',evidence:{...emptyEvidence(),releaseApproved:true},updatedAt:input.now ?? new Date().toISOString()};
}

export function advance(record:ControlPlaneRecord, patch:Partial<ControlPlaneEvidence>, now=new Date().toISOString()):ControlPlaneRecord {
  const evidence={...record.evidence,...patch};
  const all=ACTIVATION_GATES.every(g=>evidence[g]);
  const healthAndDeploy=evidence.health && evidence.deployment;
  let state:ControlPlaneState=record.state;
  if(all) state='LIVE_VERIFIED';
  else if(healthAndDeploy) state='DEGRADED';
  else if(Object.values(evidence).some(v=>v===true)) state=record.state;
  return {...record,evidence,state,updatedAt:now};
}

export function fail(record:ControlPlaneRecord, reason:string, now=new Date().toISOString()):ControlPlaneRecord {
  if(!reason.trim()) throw new Error('failure reason is required');
  return {...record,state:'FAILED',failureReason:reason,updatedAt:now};
}

export function assertPublicActivation(record:ControlPlaneRecord):void {
  if(record.state!=='LIVE_VERIFIED' || !ACTIVATION_GATES.every(g=>record.evidence[g])) throw new Error('public activation requires every control-plane gate');
}
