import { createHash } from 'node:crypto';

export type JournalEventType =
  | 'INTELLIGENCE_DECISION'
  | 'POLICY_EVALUATION'
  | 'APPROVAL'
  | 'ENFORCEMENT'
  | 'ADAPTER_EXECUTION'
  | 'ATTESTATION';

export interface ControlJournalEvent {
  id: string;
  tenantId: string;
  sequence: number;
  type: JournalEventType;
  subjectId: string;
  outcome: 'ALLOW' | 'DENY' | 'SUCCESS' | 'FAILED';
  createdAt: string;
  previousHash: string | null;
  integrityHash: string;
  metadata?: Record<string, string>;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(event: Omit<ControlJournalEvent, 'integrityHash'>): string {
  return JSON.stringify(event);
}

export function appendJournalEvent(
  events: readonly ControlJournalEvent[],
  input: Omit<ControlJournalEvent, 'id' | 'sequence' | 'previousHash' | 'integrityHash'>,
): ControlJournalEvent {
  const tenantEvents = events.filter((event) => event.tenantId === input.tenantId);
  const previous = tenantEvents.at(-1) ?? null;
  const sequence = previous ? previous.sequence + 1 : 1;
  const previousHash = previous?.integrityHash ?? null;
  const base = { ...input, sequence, previousHash };
  const id = hash(canonical(base));
  const integrityHash = hash(`${id}:${canonical(base)}`);
  return { ...base, id, integrityHash };
}

export function verifyJournal(events: readonly ControlJournalEvent[], tenantId: string): boolean {
  const scoped = events.filter((event) => event.tenantId === tenantId);
  for (let index = 0; index < scoped.length; index += 1) {
    const event = scoped[index];
    const expectedPrevious = index === 0 ? null : scoped[index - 1].integrityHash;
    if (event.sequence !== index + 1 || event.previousHash !== expectedPrevious) return false;
    const base = { ...event } as Omit<ControlJournalEvent, 'integrityHash'>;
    delete (base as Partial<ControlJournalEvent>).integrityHash;
    const id = hash(canonical(base));
    if (id !== event.id || hash(`${event.id}:${canonical(base)}`) !== event.integrityHash) return false;
  }
  return true;
}

export function isolateJournal(events: readonly ControlJournalEvent[], tenantId: string): ControlJournalEvent[] {
  return events.filter((event) => event.tenantId === tenantId).map((event) => ({ ...event }));
}
