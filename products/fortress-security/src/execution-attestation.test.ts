import { attestExecution, verifyExecutionAttestation } from './execution-attestation';

test('creates and verifies deterministic execution attestation', () => {
  const input = {
    tenantId: 'tenant-a', decisionId: 'decision-1', adapterName: 'safe-noop',
    action: 'REMEDIATION_REVIEW', targetId: 'asset-1', outcome: 'SUCCESS' as const,
    executedAt: '2026-10-28T06:00:00.000Z', reason: 'Safe adapter completed contract operation.',
  };
  const first = attestExecution(input);
  const second = attestExecution(input);
  expect(first.id).toBe(second.id);
  expect(first.integrityHash).toBe(second.integrityHash);
  expect(verifyExecutionAttestation(first)).toBe(true);
});

test('detects tampering', () => {
  const attestation = attestExecution({
    tenantId: 'tenant-a', decisionId: 'decision-1', adapterName: 'safe-noop',
    action: 'REMEDIATION_REVIEW', targetId: 'asset-1', outcome: 'DENIED',
    executedAt: '2026-10-28T06:00:00.000Z', reason: 'Denied by adapter contract.',
  });
  expect(verifyExecutionAttestation({ ...attestation, targetId: 'asset-2' })).toBe(false);
});
