export * from './types.js';
export * from './modules.js';
export * from './engine.js';

export const IZAKHONO_SUPER_ENGINE = {
  id: 'izakhono-super-engine',
  architecture: 'linux-open-source-first',
  principle: 'total-platform-independence',
  evolution: 'governed-continuous-evolution',
  security: 'FORTRESS',
  network: 'I-NET',
  ownedFirst: true,
  externalAdaptersReplaceable: true,
  privacyByDefault: true,
  rollbackRequired: true,
} as const;
