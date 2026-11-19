import { strict as assert } from 'node:assert';
import { provisionPaidOrder, type RuntimeAdapter, type PaymentEvidenceVerifier, type PaidOrder } from './order-provisioning-orchestrator';
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
const order:PaidOrder={orderId:'ORD-100',customerId:'CUS-1',merchantId:'MER-1',amountMinor:14900,currency:'ZAR',blueprint,requestedCapabilities:[...blueprint.workflow],payment:{reference:'PAY-1'}};
const evidence={verified:true as const,status:'paid' as const,orderId:'ORD-100',customerId:'CUS-1',merchantId:'MER-1',amountMinor:14900,currency:'ZAR',paymentReference:'PAY-1',providerTransactionId:'provider-tx-1',evidenceId:'pay-evidence-1'};
const verifier:PaymentEvidenceVerifier={async verify(input){assert.deepEqual(input,{orderId:'ORD-100',customerId:'CUS-1',merchantId:'MER-1',amountMinor:14900,currency:'ZAR',paymentReference:'PAY-1'});return evidence;}};

const result=await provisionPaidOrder(order,adapter,verifier,'2026-10-26T20:00:00.000Z');
assert.equal(result.controlPlane.state,'LIVE_VERIFIED');
assert.equal(result.job.status,'LIVE_VERIFIED');
assert.equal(result.handover.customerId,'CUS-1');
assert.equal(result.paymentEvidence.evidenceId,'pay-evidence-1');

const neverCalled:PaymentEvidenceVerifier={async verify(){throw new Error('not paid in authoritative service');}};
await assert.rejects(()=>provisionPaidOrder({...order,orderId:'ORD-101'},adapter,neverCalled),'not paid in authoritative service');
await assert.rejects(()=>provisionPaidOrder(order,adapter,{async verify(){return {...evidence,amountMinor:1};}}),'amount or currency does not match');
await assert.rejects(()=>provisionPaidOrder(order,adapter,{async verify(){return {...evidence,customerId:'CUS-ATTACKER'};}}),'identity does not match');
await assert.rejects(()=>provisionPaidOrder(order,adapter,{async verify(){return {...evidence,status:'failed' as 'paid'};}}),'paid or settled');

console.log('order-provisioning-orchestrator: PASS');
