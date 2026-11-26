import assert from 'node:assert/strict';
import { PostgresDnsGovernanceStore, type FortressSqlConnection } from './dns-governance-store.js';

const calls: Array<{ sql: string; values?: unknown[] }> = [];
let closed = 0;
let failAudit = false;
const row = {
  id: 'approval-1',
  tenant_id: 'tenant-a',
  action: 'dns.publish' as const,
  resource: 'dns-zone:zone-1',
  zone_name: 'example.com',
  desired_serial: '2026112601',
  environment: 'production' as const,
  decision: 'APPROVED' as const,
  approver_id: 'security-admin-2',
  expires_at: '2026-11-26T13:00:00.000Z',
};
const connection: FortressSqlConnection = {
  async query(sql, values = []) {
    calls.push({ sql, values });
    if (failAudit && sql.includes('INSERT INTO fortress_dns_publication_audit')) {
      throw new Error('audit database unavailable');
    }
    if (sql.includes('FROM fortress_dns_publication_approvals')) {
      return { rows: [row] } as never;
    }
    if (sql.includes('INSERT INTO fortress_dns_publication_audit')) {
      return { rows: [], rowCount: 1 } as never;
    }
    return { rows: [] } as never;
  },
  async end() { closed += 1; },
};
const store = new PostgresDnsGovernanceStore(async () => connection);

async function main() {
  const approval = await store.resolveApproval('approval-1');
  assert.deepEqual(approval, {
    id: 'approval-1',
    tenantId: 'tenant-a',
    action: 'dns.publish',
    resource: 'dns-zone:zone-1',
    zoneName: 'example.com',
    desiredSerial: 2026112601,
    environment: 'production',
    decision: 'APPROVED',
    approverId: 'security-admin-2',
    expiresAt: '2026-11-26T13:00:00.000Z',
  });
  assert.match(calls[0].sql, /revoked_at IS NULL/);
  assert.deepEqual(calls[0].values, ['approval-1']);

  await store.appendAudit({
    id: 'audit-1',
    occurredAt: '2026-11-26T12:00:00.000Z',
    principalId: 'owner-1',
    tenantId: 'tenant-a',
    action: 'dns.publish',
    resource: 'dns-zone:zone-1',
    outcome: 'ALLOWED',
    reason: 'approved',
  });
  const insert = calls.find(call => call.sql.includes('INSERT INTO fortress_dns_publication_audit'));
  assert.ok(insert);
  assert.deepEqual(insert.values, [
    'audit-1', '2026-11-26T12:00:00.000Z', 'owner-1', 'tenant-a',
    'dns.publish', 'dns-zone:zone-1', 'ALLOWED', 'approved', null,
  ]);

  failAudit = true;
  await assert.rejects(store.appendAudit({
    id: 'audit-2',
    occurredAt: '2026-11-26T12:01:00.000Z',
    principalId: 'owner-1',
    tenantId: 'tenant-a',
    action: 'dns.publish',
    resource: 'dns-zone:zone-1',
    outcome: 'DENIED',
    reason: 'denied',
  }), /audit database unavailable/);
  assert.equal(closed, 3);
  console.log('FORTRESS DNS governance PostgreSQL adapter tests: PASS');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
