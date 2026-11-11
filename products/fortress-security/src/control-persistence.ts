import type { ControlJournalEvent } from './control-journal';
import { verifyJournal } from './control-journal';

export interface ControlJournalStore {
  append(event: ControlJournalEvent): void;
  list(tenantId: string): ControlJournalEvent[];
}

export class InMemoryControlJournalStore implements ControlJournalStore {
  private readonly events: ControlJournalEvent[] = [];

  append(event: ControlJournalEvent): void {
    const current = this.list(event.tenantId);
    if (current.length > 0 && event.sequence !== current[current.length - 1].sequence + 1) {
      throw new Error('SEQUENCE_CONFLICT');
    }
    if (current.length > 0 && event.previousHash !== current[current.length - 1].integrityHash) {
      throw new Error('CHAIN_CONFLICT');
    }
    if (current.length === 0 && event.sequence !== 1) throw new Error('INVALID_INITIAL_SEQUENCE');
    this.events.push({ ...event });
  }

  list(tenantId: string): ControlJournalEvent[] {
    return this.events.filter((event) => event.tenantId === tenantId).map((event) => ({ ...event }));
  }
}

export interface ReplayResult {
  tenantId: string;
  events: ControlJournalEvent[];
  verified: boolean;
  lastSequence: number;
}

export function replayControlJournal(store: ControlJournalStore, tenantId: string): ReplayResult {
  const events = store.list(tenantId);
  const verified = verifyJournal(events, tenantId);
  return {
    tenantId,
    events,
    verified,
    lastSequence: events.at(-1)?.sequence ?? 0,
  };
}

export function restoreControlJournal(
  store: ControlJournalStore,
  tenantId: string,
  events: readonly ControlJournalEvent[],
): ReplayResult {
  if (events.some((event) => event.tenantId !== tenantId)) throw new Error('TENANT_MISMATCH');
  if (!verifyJournal(events, tenantId)) throw new Error('INVALID_JOURNAL');
  for (const event of events) store.append(event);
  return replayControlJournal(store, tenantId);
}
