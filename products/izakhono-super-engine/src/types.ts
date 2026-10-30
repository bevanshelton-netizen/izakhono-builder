export type EngineModuleId =
  | 'compute' | 'ai' | 'data' | 'storage' | 'network' | 'security' | 'identity'
  | 'payments' | 'automation' | 'developer' | 'media' | 'mobility' | 'business'
  | 'communications' | 'provisioning' | 'search' | 'analytics' | 'edge' | 'recovery'
  | 'marketplace';

export type RuntimeKind = 'linux';
export type AdapterKind = 'native' | 'container' | 'vm' | 'wasm' | 'external';
export type EvolutionDecision = 'proposed' | 'approved' | 'rejected' | 'deployed' | 'rolled-back';

export interface EngineModule {
  id: EngineModuleId;
  name: string;
  version: string;
  required: boolean;
  ownedFirst: boolean;
  externalAdaptersReplaceable: boolean;
  fortressProtected: boolean;
  adapterKinds: AdapterKind[];
}

export interface EvolutionProposal {
  id: string;
  target: EngineModuleId | 'core';
  reason: string;
  currentVersion: string;
  candidateVersion: string;
  benchmarkRequired: boolean;
  securityReviewRequired: boolean;
  privacyReviewRequired: boolean;
  rollbackAvailable: boolean;
  decision: EvolutionDecision;
}

export interface EngineHealth {
  ready: boolean;
  runtime: RuntimeKind;
  modulesRegistered: number;
  requiredModulesHealthy: boolean;
  fortressEnforced: boolean;
  inetConnected: boolean;
  evolutionEnabled: boolean;
}
