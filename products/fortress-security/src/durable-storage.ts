import type { ControlJournalEvent } from './control-journal';
import { verifyJournal } from './control-journal';

export interface DurableAppendRequest {
  tenantId: string;
  event: ControlJournalEvent;
  idempotencyKey: string;
  expectedLastSequence: number;
  expectedLastHash: string;
}

export interface DurableAppendResult {
  accepted: boolean;
  duplicate: boolean;
  lastSequence: number;
  lastHash: string;
}

/**
 * Reference contract for an IZAKHONO-owned durable journal adapter.
 * Implementations must make the append decision atomic at the tenant boundary.
 */
export interface DurableControlJournalStore {
  appendAtomic(request: DurableAppendRequest): DurableAppendResult;
  list(tenantId: string): ControlJournalEvent[];
}

export class InMemoryDurableControlJournalStore implements DurableControlJournalStore {
  private readonly journals = new Map<string, ControlJournalEvent[]>();
  private readonly idempotency = new Map<string, DurableAppendResult>();

  appendAtomic(request: DurableAppendRequest): DurableAppendResult {
    const { tenantId, event, idempotencyKey } = request;
    if (event.tenantId !== tenantId) throw new Error('TENANT_MISMATCH');
    if (!idempotencyKey.trim()) throw new Error('INVALID_IDEMPOTENCY_KEY');

    const prior = this.idempotency.get(`${tenantId}:${idempotencyKey}`);
    if (prior) return { ...prior, duplicate: true };

    const current = this.journals.get(tenantId) ?? [];
    const lastSequence = current.at(-1)?.sequence ?? 0;
    const lastHash = current.at(-1)?.integrityHash ?? '';

    if (request.expectedLastSequence !== lastSequence) throw new Error('CONCURRENCY_CONFLICT');
    if (request.expectedLastHash !== lastHash) throw new Error('CHAIN_CONFLICT');
    if (event.sequence !== lastSequence + 1) throw new Error('SEQUENCE_CONFLICT');
    if (event.previousHash !== lastHash) throw new Error('PREVIOUS_HASH_CONFLICT');
    if (!verifyJournal([...current, event], tenantId)) throw new Error('INVALID_EVENT');

    const next = [...current, { ...event }];
    this.journals.set(tenantId, next);
    const result: DurableAppendResult = {
      accepted: true,
      duplicate: false,
      lastSequence: event.sequence,
      lastHash: event.integrityHash,
    };
    this.idempotency.set(`${tenantId}:${idempotencyKey}`, { ...result });
    return result;
  }

  list(tenantId: string): ControlJournalEvent[] {
    return (this.journals.get(tenantId) ?? []).map((event) => ({ ...event }));
  }
}
