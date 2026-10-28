import { enforce, verifyEnforcementIntegrity } from './enforcement-gateway';

test('enforcement decision has verifiable structure', () => {
  const decision = enforce({
    tenantId: 'tenant-a', actorId: 'actor-a', action: 'REMEDIATION_REVIEW', targetId: 'asset-a',
    policyId: 'policy-a', approvalId: 'approval-a', approvalState: 'APPROVED',
    now: '2026-10-28T06:00:00.000Z',
  });
  expect(decision.outcome).toBe('ALLOW');
  expect(verifyEnforcementIntegrity(decision)).toBe(true);
});

test('rejects malformed or tampered integrity fields', () => {
  const decision = enforce({
    tenantId: 'tenant-a', actorId: 'actor-a', action: 'REMEDIATION_REVIEW', targetId: 'asset-a',
    policyId: 'policy-a', approvalId: 'approval-a', approvalState: 'APPROVED',
    now: '2026-10-28T06:00:00.000Z',
  });
  expect(verifyEnforcementIntegrity({ ...decision, integrityHash: 'tampered' })).toBe(false);
});
