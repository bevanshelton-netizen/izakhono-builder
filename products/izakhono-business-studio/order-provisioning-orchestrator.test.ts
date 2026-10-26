import { strict as assert } from 'node:assert';
import { provisionPaidOrder, type RuntimeAdapter } from './order-provisioning-orchestrator';
import type { Blueprint } from './provisioner-runtime';

const blueprint:Blueprint={schemaVersion:'1.0',business:{name:'Test Business',description:'Provisioning test'},score:100,workflow:['WEBSITE','DOMAIN','DNS','SSL','PROVISIONING'],outputs:['site'],status:'PROVISIONING_PENDING'};
const adapter:RuntimeAdapter={
  async selectNode(){return {nodeId:'node-test-01',routeClass:'external-resilience'};},
  async provisionNode(){return 'provisioned';},
  async health(){return 'healthy';},
  async deploy(){return 'deployed';},
  async edge(){return 'edge-ready';},
  async tls(){return 'tls-ready';},
  async dns(){return 'dns-ready';},
  async smoke(){return 'smoke-passed';},
  async rollbackReady(){return 'rollback-ready';}
};

const result=await provisionPaidOrder({orderId:'ORD-100',customerId:'CUS-1',blueprint,requestedCapabilities:[...blueprint.workflow],payment:{verified:true,reference:'PAY-1'}},adapter,'2026-10-26T20:00:00.000Z');
assert.equal(result.controlPlane.state,'LIVE_VERIFIED');
assert.equal(result.job.status,'LIVE_VERIFIED');
assert.equal(result.handover.customerId,'CUS-1');

await assert.rejects(()=>provisionPaidOrder({orderId:'ORD-101',customerId:'CUS-2',blueprint,requestedCapabilities:['WEBSITE'],payment:{verified:false,reference:'PAY-2'}},adapter),'payment must be verified');

console.log('order-provisioning-orchestrator: PASS');
