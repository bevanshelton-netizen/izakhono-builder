import { createHash } from 'node:crypto';

export type AuditOutcome = 'ALLOW' | 'DENY';

export interface AuditEventInput {
  tenantId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: AuditOutcome;
  timestamp: string;
  metadata?: Record<string, string>;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  sequence: number;
  previousHash: string;
  eventHash: string;
}

const canonical = (value: AuditEventInput, sequence: number, previousHash: string): string =>
  JSON.stringify({ ...value, sequence, previousHash, metadata: value.metadata ?? {} });

export function createAuditEvent(input: AuditEventInput, sequence: number, previousHash = 'GENESIS'): AuditEvent {
  if (!input.tenantId || !input.actorId || !input.action || !input.targetType || !input.targetId) {
    throw new Error('Audit event requires tenant, actor, action, target type and target id');
  }
  const body = canonical(input, sequence, previousHash);
  const eventHash = createHash('sha256').update(body).digest('hex');
  const id = createHash('sha256').update(`${eventHash}|${sequence}`).digest('hex');
  return { ...input, metadata: input.metadata ?? {}, id, sequence, previousHash, eventHash };
}

export function verifyAuditChain(events: AuditEvent[]): boolean {
  let previousHash = 'GENESIS';
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.sequence !== index || event.previousHash !== previousHash) return false;
    const expectedHash = createHash('sha256')
      .update(canonical(event, event.sequence, event.previousHash))
      .digest('hex');
    if (event.eventHash !== expectedHash) return false;
    const expectedId = createHash('sha256').update(`${expectedHash}|${event.sequence}`).digest('hex');
    if (event.id !== expectedId) return false;
    previousHash = event.eventHash;
  }
  return true;
}

export function appendAuditEvent(events: AuditEvent[], input: AuditEventInput): AuditEvent[] {
  if (!verifyAuditChain(events)) throw new Error('Cannot append to an invalid audit chain');
  const previous = events.at(-1)?.eventHash ?? 'GENESIS';
  return [...events, createAuditEvent(input, events.length, previous)];
}
