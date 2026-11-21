import assert from 'node:assert/strict';
import { authorizeGateway } from './gateway.js';
import type { ConsentGrant } from './types.js';

const consent: ConsentGrant = {
  subjectId: 'user-1',
  serviceId: 'mail',
  permissions: ['read:mail', 'send:mail'],
  dataDomains: ['communications'],
  grantedAt: '2026-10-30T00:00:00.000Z',
};

const request = {
  subjectId: 'user-1',
  serviceId: 'mail',
  permission: 'read:mail' as const,
  dataDomain: 'communications' as const,
  path: '/mail/inbox',
  consent,
};

const allowed = authorizeGateway(request);
assert.equal(allowed.allowed, true);
assert.equal(allowed.route, '/mail');
assert.equal(allowed.externalBridgeAllowed, true);

const denied = authorizeGateway({ ...request, permission: 'read:files' as const });
assert.equal(denied.allowed, false);

assert.equal(authorizeGateway({ ...request, path: '/cloud/files' }).allowed, false);
assert.equal(authorizeGateway({ ...request, path: '/mailbox/inbox' }).allowed, false);
assert.equal(authorizeGateway({ ...request, path: '/mail/../cloud/files' }).allowed, false);
assert.equal(authorizeGateway({ ...request, path: '/mail/%2e%2e/cloud/files' }).allowed, false);
assert.equal(authorizeGateway({ ...request, path: '/mail/%E0%A4%A' }).allowed, false);

const crossUserGrant = { ...request, subjectId: 'user-2' };
assert.equal(authorizeGateway(crossUserGrant).allowed, false);
assert.equal(authorizeGateway(crossUserGrant).requiresConsent, true);

const crossServiceGrant = {
  ...request,
  serviceId: 'cloud',
  path: '/cloud/files',
};
assert.equal(authorizeGateway(crossServiceGrant).allowed, false);

const unknown = authorizeGateway({ ...request, serviceId: 'does-not-exist', path: '/unknown' });
assert.equal(unknown.allowed, false);

console.log('I-NET gateway tests passed');
