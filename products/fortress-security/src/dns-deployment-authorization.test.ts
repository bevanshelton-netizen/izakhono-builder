import assert from 'node:assert/strict';
import { authorizeDnsDeployment, type DnsDeploymentApproval, type DnsDeploymentIntent } from './dns-deployment-authorization.js';

const owner = { id: 'owner-1', tenantId: 'tenant-a', role: 'OWNER' as const, active: true };
const analyst = { id: 'analyst-1', tenantId: 'tenant-a', role: 'ANALYST' as const, active: true };
const intent: DnsDeploymentIntent = {
  tenantId: 'tenant-a',
  zoneId: 'zone-1',
  zoneName: 'example.com',
  desiredSerial: 2026112601,
  environment: 'production',
  approvalId: 'approval-1',
};
const approval: DnsDeploymentApproval = {
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
};
const now = new Date('2026-11-26T12:00:00.000Z');

async function run(principal = owner, value: DnsDeploymentApproval | null = approval, target = intent) {
  const events: any[] = [];
  const decision = await authorizeDnsDeployment(
    principal,
    target,
    async id => id === approval.id ? value : null,
    async event => { events.push(event); },
    now,
  );
  return { decision, events };
}

async function main() {\nconst allowed = await run();
assert.equal(allowed.decision.allowed, true);
assert.equal(allowed.decision.authorizationId, 'approval-1');
assert.equal(allowed.events.length, 1);
assert.equal(allowed.events[0].outcome, 'ALLOWED');
assert.equal(allowed.events[0].tenantId, 'tenant-a');

const analystDenied = await run(analyst);
assert.equal(analystDenied.decision.allowed, false);
assert.match(analystDenied.decision.reason, /lacks dns:publish/);
assert.equal(analystDenied.events[0].outcome, 'DENIED');

const tenantDenied = await run(owner, approval, { ...intent, tenantId: 'tenant-b' });
assert.equal(tenantDenied.decision.allowed, false);
assert.match(tenantDenied.decision.reason, /cross-tenant/);

const staleSerial = await run(owner, { ...approval, desiredSerial: 2026112600 });
assert.equal(staleSerial.decision.allowed, false);
assert.match(staleSerial.decision.reason, /exact tenant, zone, serial/);

const wrongZone = await run(owner, { ...approval, resource: 'dns-zone:zone-2' });
assert.equal(wrongZone.decision.allowed, false);

const expired = await run(owner, { ...approval, expiresAt: '2026-11-26T11:59:59.000Z' });
assert.equal(expired.decision.allowed, false);
assert.match(expired.decision.reason, /expired/);

const selfApproved = await run(owner, { ...approval, approverId: owner.id });
assert.equal(selfApproved.decision.allowed, false);
assert.match(selfApproved.decision.reason, /different active approver/);

const missing = await run(owner, null);
assert.equal(missing.decision.allowed, false);
assert.match(missing.decision.reason, /not found/);

await assert.rejects(
  authorizeDnsDeployment(owner, intent, async () => approval, async () => { throw new Error('audit store unavailable'); }, now),
  /audit store unavailable/,
);

console.log('FORTRESS DNS deployment authorization tests: PASS');\n}\n\nmain().catch(error => { console.error(error); process.exitCode = 1; });
