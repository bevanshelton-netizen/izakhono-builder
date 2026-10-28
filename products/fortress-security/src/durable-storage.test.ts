import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { InMemoryDurableControlJournalStore } from './durable-storage';
import type { ControlJournalEvent } from './control-journal';

const event = (sequence: number, previousHash = ''): ControlJournalEvent => {
  const base = {
    tenantId: 'tenant-a', sequence, type: 'POLICY_EVALUATION' as const,
    subjectId: `subject-${sequence}`, outcome: 'ALLOW' as const,
    createdAt: '2026-10-28T00:00:00.000Z', previousHash,
    metadata: { sequence },
  };
  const canonical = JSON.stringify(base);
  const integrityHash = createHash('sha256').update(canonical).digest('hex');
  return { ...base, id: `event-${sequence}`, integrityHash };
};

describe('InMemoryDurableControlJournalStore', () => {
  it('accepts an atomic first append', () => {
    const store = new InMemoryDurableControlJournalStore();
    const first = event(1);
    const result = store.appendAtomic({ tenantId: 'tenant-a', event: first, idempotencyKey: 'k1', expectedLastSequence: 0, expectedLastHash: '' });
    expect(result.accepted).toBe(true);
    expect(store.list('tenant-a')).toHaveLength(1);
  });

  it('returns the same result for a duplicate idempotency key', () => {
    const store = new InMemoryDurableControlJournalStore();
    const first = event(1);
    const request = { tenantId: 'tenant-a', event: first, idempotencyKey: 'k1', expectedLastSequence: 0, expectedLastHash: '' };
    const firstResult = store.appendAtomic(request);
    const duplicate = store.appendAtomic(request);
    expect(duplicate.accepted).toBe(firstResult.accepted);
    expect(duplicate.lastHash).toBe(firstResult.lastHash);
    expect(duplicate.duplicate).toBe(true);
    expect(store.list('tenant-a')).toHaveLength(1);
  });

  it('fails closed on stale expected sequence', () => {
    const store = new InMemoryDurableControlJournalStore();
    const first = event(1);
    store.appendAtomic({ tenantId: 'tenant-a', event: first, idempotencyKey: 'k1', expectedLastSequence: 0, expectedLastHash: '' });
    expect(() => store.appendAtomic({ tenantId: 'tenant-a', event: event(2, first.integrityHash), idempotencyKey: 'k2', expectedLastSequence: 0, expectedLastHash: '' })).toThrow('CONCURRENCY_CONFLICT');
  });

  it('rejects cross-tenant writes without changing the target journal', () => {
    const store = new InMemoryDurableControlJournalStore();
    const foreign = { ...event(1), tenantId: 'tenant-b' };
    expect(() => store.appendAtomic({ tenantId: 'tenant-a', event: foreign, idempotencyKey: 'k1', expectedLastSequence: 0, expectedLastHash: '' })).toThrow('TENANT_MISMATCH');
    expect(store.list('tenant-a')).toHaveLength(0);
  });
});
