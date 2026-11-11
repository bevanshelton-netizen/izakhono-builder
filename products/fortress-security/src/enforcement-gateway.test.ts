import { describe, expect, it } from 'vitest';
import { enforce, verifyEnforcementIntegrity } from './enforcement-gateway.js';

describe('enforcement gateway', () => {
  const base = {
    tenantId: 'tenant-a', actorId: 'security-admin', action: 'OPEN_REMEDIATION', targetId: 'finding-1', policyId: 'policy-1', approvalId: 'approval-1', approvalState: 'APPROVED' as const, now: '2026-10-28T06:00:00.000Z',
  };

  it('allows only approved, unexpired requests', () => {
    const decision = enforce(base);
    expect(decision.outcome).toBe('ALLOW');
    expect(verifyEnforcementIntegrity(decision)).toBe(true);
  });

  it('denies missing approval', () => {
    expect(enforce({ ...base, approvalState: undefined }).outcome).toBe('DENY');
  });

  it('denies expired approval', () => {
    const decision = enforce({ ...base, approvalExpiresAt: '2026-10-28T05:59:59.000Z' });
    expect(decision.outcome).toBe('DENY');
  });

  it('denies incomplete authorization context', () => {
    expect(enforce({ ...base, tenantId: '' }).outcome).toBe('DENY');
  });
});
