import { describe, expect, it } from 'vitest';
import { appendAuditEvent, createAuditEvent, verifyAuditChain } from './audit-chain.js';

const input = (action: string) => ({
  tenantId: 'tenant-a', actorId: 'user-1', action, targetType: 'finding', targetId: 'finding-1',
  outcome: 'ALLOW' as const, timestamp: '2026-10-27T20:00:00.000Z'
});

describe('audit chain', () => {
  it('creates and verifies a linked chain', () => {
    let events = [createAuditEvent(input('READ'), 0)];
    events = appendAuditEvent(events, input('REMEDIATE'));
    expect(verifyAuditChain(events)).toBe(true);
    expect(events[1].previousHash).toBe(events[0].eventHash);
  });

  it('detects tampering', () => {
    const events = [createAuditEvent(input('READ'), 0)];
    const tampered = [{ ...events[0], action: 'DELETE' }];
    expect(verifyAuditChain(tampered)).toBe(false);
  });

  it('refuses appending to a corrupted chain', () => {
    const events = [createAuditEvent(input('READ'), 0)];
    const tampered = [{ ...events[0], metadata: { changed: 'yes' } }];
    expect(() => appendAuditEvent(tampered, input('WRITE'))).toThrow(/invalid audit chain/);
  });
});
