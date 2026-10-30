import type { EngineModuleId, EvolutionProposal } from './types';

export interface EvolutionGateResult {
  approved: boolean;
  reasons: string[];
}

/** Governed evolution: proposals can be generated, but production promotion requires every safety gate. */
export class EvolutionController {
  propose(target: EngineModuleId | 'core', currentVersion: string, candidateVersion: string, reason: string): EvolutionProposal {
    return {
      id: `evo-${target}-${candidateVersion}`,
      target,
      reason,
      currentVersion,
      candidateVersion,
      benchmarkRequired: true,
      securityReviewRequired: true,
      privacyReviewRequired: true,
      rollbackAvailable: true,
      decision: 'proposed'
    };
  }

  gate(proposal: EvolutionProposal, checks: { benchmark: boolean; security: boolean; privacy: boolean; rollback: boolean }): EvolutionGateResult {
    const reasons: string[] = [];
    if (proposal.benchmarkRequired && !checks.benchmark) reasons.push('benchmark gate failed');
    if (proposal.securityReviewRequired && !checks.security) reasons.push('security gate failed');
    if (proposal.privacyReviewRequired && !checks.privacy) reasons.push('privacy gate failed');
    if (proposal.rollbackAvailable && !checks.rollback) reasons.push('rollback capability missing');
    return { approved: reasons.length === 0, reasons };
  }
}
