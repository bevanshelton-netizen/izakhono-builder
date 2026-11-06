import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, readJsonBody } from './request-guards.mjs';

function request(chunks, headers = {}, remoteAddress = '127.0.0.1') {
  return {
    headers,
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield Buffer.from(chunk);
    }
  };
}

test('parses a bounded JSON request body', async () => {
  const value = await readJsonBody(request(['{"ok":', 'true}']), 32);
  assert.deepEqual(value, { ok: true });
});

test('rejects an oversized declared body before reading it', async () => {
  await assert.rejects(
    readJsonBody(request([], { 'content-length': '100' }), 32),
    (error) => error.message === 'payload_too_large' && error.statusCode === 413
  );
});

test('rejects a streamed body as soon as it exceeds the limit', async () => {
  await assert.rejects(
    readJsonBody(request(['123456789', '0123456789']), 12),
    (error) => error.message === 'payload_too_large' && error.statusCode === 413
  );
});

test('rejects malformed JSON', async () => {
  await assert.rejects(readJsonBody(request(['{"unfinished":']), 32), SyntaxError);
});

test('rate limiting uses the socket address, not spoofable forwarding headers', () => {
  let time = 1000;
  const allow = createRateLimiter({ windowMs: 60000, limit: 2, now: () => time });
  assert.equal(allow(request([], { 'x-forwarded-for': '198.51.100.1' }, '10.0.0.5')), true);
  assert.equal(allow(request([], { 'x-forwarded-for': '203.0.113.9' }, '10.0.0.5')), true);
  assert.equal(allow(request([], { 'x-forwarded-for': '192.0.2.4' }, '10.0.0.5')), false);
  assert.equal(allow(request([], {}, '10.0.0.6')), true);
  time += 60001;
  assert.equal(allow(request([], {}, '10.0.0.5')), true);
});

test('rate limiter caps the number of tracked client addresses', () => {
  const allow = createRateLimiter({ windowMs: 60000, limit: 1, maxKeys: 1, now: () => 1000 });
  assert.equal(allow(request([], {}, '10.0.0.1')), true);
  assert.equal(allow(request([], {}, '10.0.0.2')), false);
});
