import { createHash } from 'node:crypto';

export interface AuditEvent {
  id: string;
  occurredAt: string;
  principalId: string;
  tenantId: string;
  action: string;
  resource: string;
  outcome: 'ALLOWED' | 'DENIED';
  reason?: string;
  evidenceDigest?: string;
}

export function createAuditEvent(input: Omit<AuditEvent, 'id' | 'occurredAt'>): AuditEvent {
  const occurredAt = new Date().toISOString();
  const id = createHash('sha256').update(JSON.stringify({ ...input, occurredAt })).digest('hex').slice(0, 24);
  return { ...input, id, occurredAt };
}
