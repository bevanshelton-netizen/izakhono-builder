import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { createNodeHealthChallenge } from '../src/node-health.js';

const token = 'a'.repeat(64);
const nonce = 'b'.repeat(64);

test('node health challenge signs the requested logical runtime identity', () => {
  const result = createNodeHealthChallenge({
    nodeId: 'NODE02',
    clusterId: 'izakhono-production',
    token,
    nonce,
  });

  assert.equal(result.ok, true);
  assert.equal(result.cluster, 'izakhono-production');
  assert.equal(result.runtimeNode, 'NODE02');
  assert.equal(result.authScheme, 'bearer-hmac-sha256');
  assert.equal(result.probeNonce, nonce);

  const expected = createHmac('sha256', Buffer.from(token, 'hex'))
    .update(`izakhono-production\nNODE02\n${nonce}`, 'utf8')
    .digest('hex');
  assert.equal(result.probeSignature, expected);
});

test('node health challenge rejects unknown nodes, clusters, weak keys and malformed nonces', () => {
  const base = { nodeId: 'NODE01', clusterId: 'izakhono-production', token, nonce };
  assert.equal(createNodeHealthChallenge({ ...base, nodeId: 'NODE05' }), null);
  assert.equal(createNodeHealthChallenge({ ...base, clusterId: 'other-cluster' }), null);
  assert.equal(createNodeHealthChallenge({ ...base, token: 'short' }), null);
  assert.equal(createNodeHealthChallenge({ ...base, nonce: 'not-a-nonce' }), null);
});

test('node health challenge changes when the nonce changes', () => {
  const first = createNodeHealthChallenge({ nodeId: 'NODE03', clusterId: 'izakhono-production', token, nonce });
  const second = createNodeHealthChallenge({ nodeId: 'NODE03', clusterId: 'izakhono-production', token, nonce: 'c'.repeat(64) });
  assert.notEqual(first.probeSignature, second.probeSignature);
});
