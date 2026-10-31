import assert from 'node:assert/strict';
import { buildMailControlSnapshot, canClaimProductionReady } from './mail-control-centre';

const domain = {
  domain: 'example.com',
  platform: 'test',
  status: 'verified' as const,
  checks: { mx: 'passed' as const, spf: 'passed' as const, dkim: 'passed' as const, dmarc: 'passed' as const, tls: 'passed' as const, smtp: 'passed' as const, imap: 'passed' as const, backup: 'passed' as const, fortress: 'passed' as const, monitoring: 'passed' as const },
  transport: 'owned' as const,
  lastVerifiedAt: '2026-10-31T00:00:00.000Z',
  openIncidents: 0,
};

const snapshot = buildMailControlSnapshot([domain], [
  { address: 'info@example.com', platform: 'test', status: 'active', storageUsedBytes: 100, lastAuthenticationAt: null, lastDeliveryAt: null, deliveryFailures: 0, securityStatus: 'clear', backupStatus: 'verified' },
], []);

assert.equal(snapshot.summary.managedDomains, 1);
assert.equal(snapshot.summary.verifiedDomains, 1);
assert.equal(snapshot.summary.activeMailboxes, 1);
assert.equal(snapshot.summary.openSecurityAlerts, 0);
assert.equal(canClaimProductionReady(domain), true);
assert.equal(canClaimProductionReady({ ...domain, openIncidents: 1 }), false);
assert.equal(canClaimProductionReady({ ...domain, checks: { ...domain.checks, dmarc: 'pending' } }), false);

console.log('[PASS] mail control centre state contract');
