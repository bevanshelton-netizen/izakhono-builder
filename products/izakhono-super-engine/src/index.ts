export * from './types.js';
export * from './modules.js';
export * from './engine.js';
export * from './service-bus.js';
export * from './payment-core.js';
export * from './payment-ledger.js';
export * from './payment-workflow.js';
export * from './payment-fulfillment.js';
export * from './payment-settlement.js';
export * from './payment-settlement-ledger.js';
export * from './payment-reconciliation.js';
export * from './payment-events.js';
export * from './payment-refunds.js';
export * from './payment-refund-ledger.js';
export * from './payment-orchestrator.js';
export * from './payment-supabase.js';
export * from './payment-events-supabase.js';
export * from './payment-durable.js';

export const IZAKHONO_SUPER_ENGINE = {
  id: 'izakhono-super-engine',
  architecture: 'linux-open-source-first',
  principle: 'total-platform-independence',
  evolution: 'governed-continuous-evolution',
  security: 'FORTRESS',
  network: 'I-NET',
  serviceFabric: 'zero-trust-service-bus',
  paymentFabric: 'IZAKHONO-PAY',
  paymentLedger: 'double-entry-append-only',
  paymentWorkflow: 'payment-to-provisioning',
  fulfillmentFabric: 'payment-to-provisioner',
  settlementFabric: 'merchant-settlement',
  reconciliationFabric: 'provider-reconciliation',
  eventFabric: 'durable-idempotent-payment-events',
  lifecycleFabric: 'explicit-cancel-refund-state-machine',
  persistenceFabric: 'portable-postgres-supabase-adapter',
  orchestrationFabric: 'payment-to-settlement-refund-orchestrator',
  ownedFirst: true,
  externalAdaptersReplaceable: true,
  privacyByDefault: true,
  rollbackRequired: true,
} as const;
