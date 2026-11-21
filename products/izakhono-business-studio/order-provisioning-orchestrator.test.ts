import { strict as assert } from 'node:assert';
import { provisionPaidOrder, type RuntimeAdapter, type TrustedPaymentVerifier } from './order-provisioning-orchestrator';
import type { Blueprint } from './provisioner-runtime';

const blueprint:Blueprint={schemaVersion:'1.0',business:{name:'Test Business',description:'Provisioning test'},score:100,workflow:['WEBSITE','DOMAIN','DNS','SSL','PROVISIONING'],outputs:['site'],status:'PROVISIONING_PENDING'};
const order={orderId:'ORD-100',customerId:'CUS-1',amountMinor:14900,currency:'ZAR',blueprint,requestedCapabilities:[...blueprint.workflow]};
let runtimeCalls=0;
const adapter:RuntimeAdapter={
  async selectNode(){runtimeCalls++;return {nodeId:'node-test-01',routeClass:'external-resilience'};},
  async provisionNode(){runtimeCalls++;return 'provisioned';},
  async health(){runtimeCalls++;return 'healthy';},
  async deploy(){runtimeCalls++;return 'deployed';},
  async edge(){runtimeCalls++;return 'edge-ready';},
  async tls(){runtimeCalls++;return 'tls-ready';},
  async dns(){runtimeCalls++;return 'dns-ready';},
  async smoke(){runtimeCalls++;return 'smoke-passed';},
  async rollbackReady(){runtimeCalls++;return 'rollback-ready';}
};
const paidVerifier:TrustedPaymentVerifier={async resolvePaidOrder(){return {status:'paid',orderId:'ORD-100',customerId:'CUS-1',amountMinor:14900,currency:'ZAR',reference:'PAY-1',provider:'ikhokha'};}};

const result=await provisionPaidOrder(order,adapter,paidVerifier,'2026-10-26T20:00:00.000Z');
assert.equal(result.controlPlane.state,'LIVE_VERIFIED');
assert.equal(result.job.status,'LIVE_VERIFIED');
assert.equal(result.handover.customerId,'CUS-1');
assert.ok(runtimeCalls>0);

const callsBefore=runtimeCalls;
const unpaidVerifier:TrustedPaymentVerifier={async resolvePaidOrder(){return null;}};
await assert.rejects(()=>provisionPaidOrder({...order,orderId:'ORD-101'},adapter,unpaidVerifier),'trusted payment record is not paid');
assert.equal(runtimeCalls,callsBefore,'unpaid orders must not invoke the runtime adapter');

const mismatchVerifier:TrustedPaymentVerifier={async resolvePaidOrder(){return {status:'paid',orderId:'ORD-100',customerId:'CUS-1',amountMinor:1,currency:'ZAR',reference:'PAY-2',provider:'ikhokha'};}};
await assert.rejects(()=>provisionPaidOrder(order,adapter,mismatchVerifier),/amount or currency/);
assert.equal(runtimeCalls,callsBefore,'mismatched payments must not invoke the runtime adapter');

const wrongOwnerVerifier:TrustedPaymentVerifier={async resolvePaidOrder(){return {status:'paid',orderId:'ORD-OTHER',customerId:'CUS-1',amountMinor:14900,currency:'ZAR',reference:'PAY-3',provider:'ikhokha'};}};
await assert.rejects(()=>provisionPaidOrder(order,adapter,wrongOwnerVerifier),/does not belong/);
assert.equal(runtimeCalls,callsBefore,'wrong-order payment must not invoke the runtime adapter');

console.log('order-provisioning-orchestrator: PASS');
