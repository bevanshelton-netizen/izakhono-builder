import { describe, expect, it } from 'vitest';
import { SUPER_ENGINE } from './engine.js';

describe('IZAKHONO Super Engine', () => {
  it('registers exactly 20 protected modules', () => {
    expect(SUPER_ENGINE.modules).toHaveLength(20);
    expect(SUPER_ENGINE.modules.every((m) => m.fortressProtected)).toBe(true);
  });

  it('requires Linux and I-NET', () => {
    expect(SUPER_ENGINE.runtime).toBe('linux');
    expect(SUPER_ENGINE.core.architecture).toBe('parallel-internet');
  });

  it('keeps external adapters replaceable and owned-first', () => {
    expect(SUPER_ENGINE.modules.every((m) => m.ownedFirst && m.externalAdaptersReplaceable)).toBe(true);
  });

  it('requires all evolution safety gates', () => {
    expect(() => SUPER_ENGINE.proposeEvolution({
      id: 'unsafe', target: 'core', reason: 'test', currentVersion: '1.0.0', candidateVersion: '1.1.0',
      benchmarkRequired: false, securityReviewRequired: true, privacyReviewRequired: true, rollbackAvailable: true,
    })).toThrow();
  });

  it('reports readiness only when the full core contract is present', () => {
    expect(SUPER_ENGINE.health()).toMatchObject({
      ready: true, modulesRegistered: 20, requiredModulesHealthy: true,
      fortressEnforced: true, inetConnected: true, evolutionEnabled: true,
    });
  });
});
