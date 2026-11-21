import { describe, expect, it } from 'vitest';
import { appendJournalEvent } from './control-journal';
import { InMemoryControlJournalStore, replayControlJournal, restoreControlJournal } from './control-persistence';

describe('FORTRESS v2.7 persistence and replay', () => {
  it('persists and replays a verified tenant chain', () => {
    const first = appendJournalEvent([], { tenantId: 'tenant-a', type: 'POLICY_EVALUATION', subjectId: 'p1', outcome: 'ALLOW', createdAt: '2026-10-28T06:00:00.000Z' });
    const second = appendJournalEvent([first], { tenantId: 'tenant-a', type: 'APPROVAL', subjectId: 'a1', outcome: 'ALLOW', createdAt: '2026-10-28T06:01:00.000Z' });
    const store = new InMemoryControlJournalStore();
    store.append(first);
    store.append(second);
    const replay = replayControlJournal(store, 'tenant-a');
    expect(replay.verified).toBe(true);
    expect(replay.lastSequence).toBe(2);
    expect(replay.events).toEqual([first, second]);
  });

  it('rejects cross-tenant restoration', () => {
    const event = appendJournalEvent([], { tenantId: 'tenant-b', type: 'ATTESTATION', subjectId: 'x', outcome: 'SUCCESS', createdAt: '2026-10-28T06:00:00.000Z' });
    expect(() => restoreControlJournal(new InMemoryControlJournalStore(), 'tenant-a', [event])).toThrow('TENANT_MISMATCH');
  });

  it('rejects tampered restoration', () => {
    const event = appendJournalEvent([], { tenantId: 'tenant-a', type: 'ATTESTATION', subjectId: 'x', outcome: 'SUCCESS', createdAt: '2026-10-28T06:00:00.000Z' });
    const tampered = { ...event, outcome: 'FAILED' as const };
    expect(() => restoreControlJournal(new InMemoryControlJournalStore(), 'tenant-a', [tampered])).toThrow('INVALID_JOURNAL');
  });

  it('prevents sequence and chain conflicts', () => {
    const first = appendJournalEvent([], { tenantId: 'tenant-a', type: 'ENFORCEMENT', subjectId: 'e1', outcome: 'ALLOW', createdAt: '2026-10-28T06:00:00.000Z' });
    const store = new InMemoryControlJournalStore();
    store.append(first);
    expect(() => store.append({ ...first, sequence: 3 })).toThrow('SEQUENCE_CONFLICT');
    expect(() => store.append({ ...first, sequence: 2, previousHash: 'wrong' })).toThrow('CHAIN_CONFLICT');
  });
});
