import { appendJournalEvent, verifyJournal, isolateJournal } from './control-journal';

test('creates a deterministic tenant-scoped journal chain', () => {
  const first = appendJournalEvent([], {
    tenantId: 'tenant-a', type: 'ENFORCEMENT', subjectId: 'decision-1',
    outcome: 'ALLOW', createdAt: '2026-10-28T00:00:00.000Z', metadata: { policyId: 'p1' },
  });
  const second = appendJournalEvent([first], {
    tenantId: 'tenant-a', type: 'ADAPTER_EXECUTION', subjectId: 'decision-1',
    outcome: 'SUCCESS', createdAt: '2026-10-28T00:00:01.000Z',
  });
  expect(second.sequence).toBe(2);
  expect(second.previousHash).toBe(first.integrityHash);
  expect(verifyJournal([first, second], 'tenant-a')).toBe(true);
});

test('detects tampering', () => {
  const event = appendJournalEvent([], {
    tenantId: 'tenant-a', type: 'ATTESTATION', subjectId: 'a1',
    outcome: 'SUCCESS', createdAt: '2026-10-28T00:00:00.000Z',
  });
  const tampered = { ...event, outcome: 'FAILED' as const };
  expect(verifyJournal([tampered], 'tenant-a')).toBe(false);
});

test('isolates tenants', () => {
  const a = appendJournalEvent([], { tenantId: 'a', type: 'APPROVAL', subjectId: 'x', outcome: 'ALLOW', createdAt: '2026-10-28T00:00:00.000Z' });
  const b = appendJournalEvent([], { tenantId: 'b', type: 'APPROVAL', subjectId: 'y', outcome: 'ALLOW', createdAt: '2026-10-28T00:00:00.000Z' });
  expect(isolateJournal([a, b], 'a')).toEqual([a]);
  expect(verifyJournal([a, b], 'a')).toBe(true);
});
