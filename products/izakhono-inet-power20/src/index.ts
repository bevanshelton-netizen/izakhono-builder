export * from './types.js';
export * from './privacy.js';
export * from './catalog.js';

export const I_NET_CORE = {
  id: 'inet-core',
  name: 'IZAKHONO I-NET Core',
  version: '1.0.0',
  architecture: 'parallel-internet',
  identity: 'IZAKHONO ID',
  security: 'FORTRESS',
  privacy: 'deny-by-default',
  ownedFirst: true,
  externalInternetBridge: true,
  offlineResilience: true,
  powerBenchmark: 20,
} as const;
