import { describe, expect, it } from 'vitest';
import { ingestControlEvent, type ControlApiRequest } from './control-api';
import { verifyJournal, type ControlJournalEvent } from './control-journal';

const request: ControlApiRequest = {
  tenantId: 'tenant-a',
  actorId: 'security-admin-1',
  eventType: 'POLICY_EVALUATION',
  subjectId: 'policy-123',
  outcome: 'ALLOW',
  timestamp: '2026-10-28T05:00:00.000Z',
  correlationId: 'corr-1',
};

describe('FORTRESS v2.6 control API', () => {
  it('ingests a valid event into the requested tenant journal', () => {
    const result = ingestControlEvent([], request, 'tenant-a');
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.event.tenantId).toBe('tenant-a');
    expect(result.event.sequence).toBe(1);
    expect(result.event.metadata?.actorId).toBe('security-admin-1');
    expect(verifyJournal([result.event], 'tenant-a')).toBe(true);
  });

  it('rejects a cross-tenant request before writing an event', () => {
    const result = ingestControlEvent([], request, 'tenant-b');
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.code).toBe('TENANT_MISMATCH');
  });

  it('rejects missing tenant context without writing an event', () => {
    const invalid = { ...request, tenantId: '' };
    const result = ingestControlEvent([], invalid, undefined);
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.code).toBe('INVALID_REQUEST');
  });

  it('rejects invalid event types, outcomes, and timestamps', () => {
    const invalid = {
      ...request,
      eventType: 'UNKNOWN' as ControlApiRequest['eventType'],
      outcome: 'UNKNOWN' as ControlApiRequest['outcome'],
      timestamp: 'not-a-date',
    };
    const result = ingestControlEvent([], invalid, 'tenant-a');
    expect(result.accepted).toBe(false);
  });

  it('produces a deterministic request identity', () => {
    const first = ingestControlEvent([], request, 'tenant-a');
    const second = ingestControlEvent([], request, 'tenant-a');
    expect(first.requestId).toBe(second.requestId);
  });

  it('preserves a tenant-specific sequence when other tenants are present', () => {
    const first = ingestControlEvent([], request, 'tenant-a');
    expect(first.accepted).toBe(true);
    if (!first.accepted) return;

    const tenantB: ControlJournalEvent = {
      id: 'b',
      tenantId: 'tenant-b',
      sequence: 1,
      type: 'ATTESTATION',
      subjectId: 'attestation-b',
      outcome: 'SUCCESS',
      createdAt: '2026-10-28T05:01:00.000Z',
      previousHash: null,
      integrityHash: 'b',
    };

    const second = ingestControlEvent([first.event, tenantB], request, 'tenant-a');
    expect(second.accepted).toBe(true);
    if (!second.accepted) return;
    expect(second.event.sequence).toBe(2);
    expect(second.event.previousHash).toBe(first.event.integrityHash);
  });
});
