import { I_NET_CORE } from '../../izakhono-inet-power20/src/index.js';
import { SUPER_ENGINE_MODULES } from './modules.js';
import type { EngineHealth, EvolutionProposal, EngineModuleId } from './types.js';

export class IzakhonoSuperEngine {
  readonly id = 'izakhono-super-engine';
  readonly version = '1.0.0';
  readonly runtime = 'linux' as const;
  readonly modules = SUPER_ENGINE_MODULES;
  readonly core = I_NET_CORE;
  private proposals = new Map<string, EvolutionProposal>();

  health(): EngineHealth {
    return {
      ready: this.modules.length === 20 && this.modules.every((m) => m.required && m.fortressProtected),
      runtime: this.runtime,
      modulesRegistered: this.modules.length,
      requiredModulesHealthy: this.modules.every((m) => m.required),
      fortressEnforced: this.modules.every((m) => m.fortressProtected),
      inetConnected: this.core.architecture === 'parallel-internet',
      evolutionEnabled: true,
    };
  }

  proposeEvolution(input: Omit<EvolutionProposal, 'decision'>): EvolutionProposal {
    const proposal: EvolutionProposal = { ...input, decision: 'proposed' };
    if (!proposal.benchmarkRequired || !proposal.securityReviewRequired || !proposal.privacyReviewRequired || !proposal.rollbackAvailable) {
      throw new Error('Evolution proposal rejected: benchmark, security, privacy and rollback gates are mandatory.');
    }
    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  approveEvolution(id: string): EvolutionProposal {
    const proposal = this.requireProposal(id);
    const approved = { ...proposal, decision: 'approved' as const };
    this.proposals.set(id, approved);
    return approved;
  }

  recordDeployment(id: string, rolledBack = false): EvolutionProposal {
    const proposal = this.requireProposal(id);
    if (proposal.decision !== 'approved') throw new Error('Evolution must be approved before deployment.');
    const result = { ...proposal, decision: rolledBack ? ('rolled-back' as const) : ('deployed' as const) };
    this.proposals.set(id, result);
    return result;
  }

  module(id: EngineModuleId) {
    return this.modules.find((module) => module.id === id);
  }

  private requireProposal(id: string) {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new Error(`Unknown evolution proposal: ${id}`);
    return proposal;
  }
}

export const SUPER_ENGINE = new IzakhonoSuperEngine();
