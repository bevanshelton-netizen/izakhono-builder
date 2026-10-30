export * from './types.js';
export * from './modules.js';
export * from './engine.js';
export * from './service-bus.js';
export * from './payment-core.js';

export const IZAKHONO_SUPER_ENGINE = {
  id: 'izakhono-super-engine',
  architecture: 'linux-open-source-first',
  principle: 'total-platform-independence',
  evolution: 'governed-continuous-evolution',
  security: 'FORTRESS',
  network: 'I-NET',
  serviceFabric: 'zero-trust-service-bus',
  paymentFabric: 'IZAKHONO-PAY',
  ownedFirst: true,
  externalAdaptersReplaceable: true,
  privacyByDefault: true,
  rollbackRequired: true,
} as const;
