import assert from 'node:assert/strict';
import { appendAuditEvent, createAuditEvent, verifyAuditChain } from './audit-chain.js';

const input = (action: string) => ({
  tenantId: 'tenant-a', actorId: 'user-1', action, targetType: 'finding', targetId: 'finding-1',
  outcome: 'ALLOW' as const, timestamp: '2026-10-27T20:00:00.000Z'
});

const first = createAuditEvent(input('READ'), 0);
const events = appendAuditEvent([first], input('REMEDIATE'));
assert.equal(verifyAuditChain(events), true);
assert.equal(events[1].previousHash, events[0].eventHash);

const tampered = [{ ...first, action: 'DELETE' }];
assert.equal(verifyAuditChain(tampered), false);

const corrupted = [{ ...first, metadata: { changed: 'yes' } }];
assert.throws(() => appendAuditEvent(corrupted, input('WRITE')), /invalid audit chain/);

console.log('FORTRESS audit-chain tests passed');
