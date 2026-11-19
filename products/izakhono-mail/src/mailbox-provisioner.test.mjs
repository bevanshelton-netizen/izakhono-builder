import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { provisionMailbox } from './mailbox-provisioner.mjs';

const domainState = { domainId: 'domain-1', domain: 'izakhonoafrica.co.za', dnsZoneFile: 'zone-data', created: false };

test('mailbox provisioning fails closed when no verified domain exists', async () => {
  let factoryCalled = false;
  const result = await provisionMailbox({
    platform: 'KORA NETWORK',
    mailbox: 'info',
    transportFactory: () => { factoryCalled = true; throw new Error('must-not-run'); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.state, 'domain_required');
  assert.equal(factoryCalled, false);
});

test('mailbox provisioning requires a pre-created Stalwart domain', async () => {
  const result = await provisionMailbox({
    platform: 'IZAKHONO',
    mailbox: 'bevans',
    transportFactory: () => ({
      ensureDomain: async () => { throw new Error('stalwart-domain-not-provisioned'); },
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.state, 'domain_not_provisioned');
});

test('mailbox provisioning does not create accounts until public DNS verifies', async () => {
  let createCalled = false;
  const result = await provisionMailbox({
    platform: 'IZAKHONO',
    mailbox: 'bevans',
    transportFactory: () => ({
      ensureDomain: async () => domainState,
      createMailbox: async () => { createCalled = true; throw new Error('must-not-run'); },
    }),
    dnsVerifier: async () => ({ verified: false, status: 'dns_pending', records: [] }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.state, 'dns_pending');
  assert.equal(result.domain_ready, true);
  assert.equal(createCalled, false);
});

test('mailbox provisioning returns a one-time password but never stores it in evidence', async () => {
  const evidenceDirectory = mkdtempSync(join(tmpdir(), 'izakhono-mail-evidence-'));
  try {
    let suppliedPassword = '';
    const result = await provisionMailbox({
      platform: 'IZAKHONO',
      mailbox: 'bevans',
      evidenceDirectory,
      transportFactory: () => ({
        ensureDomain: async () => domainState,
        createMailbox: async input => {
          suppliedPassword = input.password;
          return {
            created: true,
            address: 'bevans@izakhonoafrica.co.za',
            domainId: 'domain-1',
            accountId: 'account-1',
          };
        },
      }),
      dnsVerifier: async () => ({ verified: true, status: 'verified', records: [] }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.state, 'mailbox_created_credentials_issued_once');
    assert.equal(result.password, suppliedPassword);
    assert.equal(suppliedPassword.length >= 40, true);
    const evidence = readFileSync(result.evidence_path, 'utf8');
    assert.match(evidence, /"password_stored": false/);
    assert.doesNotMatch(evidence, new RegExp(suppliedPassword));
    assert.match(evidence, /"transport": "stalwart-jmap"/);
  } finally {
    rmSync(evidenceDirectory, { recursive: true, force: true });
  }
});

test('existing Stalwart mailbox never receives a silently regenerated password', async () => {
  const result = await provisionMailbox({
    platform: 'IZAKHONO',
    mailbox: 'bevans',
    transportFactory: () => ({
      ensureDomain: async () => domainState,
      createMailbox: async () => ({
        created: false,
        state: 'credentials_recovery_required',
        address: 'bevans@izakhonoafrica.co.za',
        accountId: 'account-1',
      }),
    }),
    dnsVerifier: async () => ({ verified: true, status: 'verified', records: [] }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.state, 'credentials_recovery_required');
  assert.equal('password' in result, false);
});

console.log('[PASS] mailbox provisioning DNS gate, one-time credentials and recovery behavior verified.');
