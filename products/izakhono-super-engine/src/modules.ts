import type { EngineModule, EngineModuleId } from './types.js';

const definitions: Array<[EngineModuleId, string]> = [
  ['compute', 'Compute Engine'], ['ai', 'AI Engine'], ['data', 'Data Engine'],
  ['storage', 'Storage Engine'], ['network', 'Network Engine'], ['security', 'Security Engine'],
  ['identity', 'Identity Engine'], ['payments', 'Payment Engine'], ['automation', 'Automation Engine'],
  ['developer', 'Developer Engine'], ['media', 'Media Engine'], ['mobility', 'Mobility Engine'],
  ['business', 'Business Engine'], ['communications', 'Communications Engine'],
  ['provisioning', 'Provisioning Engine'], ['search', 'Search Engine'], ['analytics', 'Analytics Engine'],
  ['edge', 'Edge Engine'], ['recovery', 'Recovery Engine'], ['marketplace', 'Marketplace Engine'],
];

export const SUPER_ENGINE_MODULES: readonly EngineModule[] = definitions.map(([id, name]) => ({
  id,
  name,
  version: '1.0.0',
  required: true,
  ownedFirst: true,
  externalAdaptersReplaceable: true,
  fortressProtected: true,
  adapterKinds: ['native', 'container', 'vm', 'wasm', 'external'],
}));
