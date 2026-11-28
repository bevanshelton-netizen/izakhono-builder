import test from 'node:test';
import assert from 'node:assert/strict';
import { corsHeaders, rateAllowed } from '../lib.js';
import { config } from '../config.js';

test('CORS never reflects an origin that is not explicitly trusted', () => {
  const headers = corsHeaders('https://untrusted-origin.invalid');
  assert.deepEqual(headers, {});
});

test('CORS emits allow headers only for an exact configured origin', () => {
  const origin = config.allowedOrigins[0];
  if (!origin) {
    assert.deepEqual(corsHeaders('https://example.invalid'), {});
    return;
  }
  assert.equal(corsHeaders(origin)['access-control-allow-origin'], origin);
  assert.deepEqual(corsHeaders('https://untrusted-origin.invalid'), {});
});

test('rate limiter blocks requests above the configured window limit', () => {
  const key = `nav-security-test-${process.pid}-limit`;
  const now = 1_000_000;
  for (let i = 0; i < config.rateLimit.max; i += 1) {
    assert.equal(rateAllowed(key, now), true);
  }
  assert.equal(rateAllowed(key, now), false);
});

test('rate limiter starts a fresh bucket after the configured window expires', () => {
  const key = `nav-security-test-${process.pid}-expiry`;
  const now = 2_000_000;
  assert.equal(rateAllowed(key, now), true);
  assert.equal(rateAllowed(key, now + config.rateLimit.windowMs), true);
});
