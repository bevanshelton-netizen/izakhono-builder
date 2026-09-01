import test from 'node:test';
import assert from 'node:assert/strict';
import { IzakhonoPayClient, IzakhonoPayError } from '../sdk/server.mjs';

test('server SDK sends merchant identity and stable idempotency key', async () => {
  let seen;
  const client = new IzakhonoPayClient({
    baseUrl: 'https://pay.example.test/',
    apiKey: 'merchant-secret',
    appSlug: 'kora',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify({ ok: true, intent: { id: 'pi_1', status: 'requires_action' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const intent = await client.createIntent({
    amountMinor: 7900,
    email: 'viewer@example.com',
    description: 'KORA purchase',
    idempotencyKey: 'order:kora:12345',
    metadata: { order_id: '12345' },
  });

  assert.equal(intent.id, 'pi_1');
  assert.equal(seen.url, 'https://pay.example.test/api/v1/intents');
  assert.equal(seen.init.headers['x-izakhono-app'], 'kora');
  assert.equal(seen.init.headers['x-izakhono-key'], 'merchant-secret');
  assert.equal(seen.init.headers['idempotency-key'], 'order:kora:12345');
  const body = JSON.parse(seen.init.body);
  assert.equal(body.amount_minor, 7900);
  assert.equal(body.app_slug, undefined);
});

test('server SDK refuses payment creation without stable idempotency key', async () => {
  const client = new IzakhonoPayClient({
    baseUrl: 'https://pay.example.test',
    apiKey: 'merchant-secret',
    appSlug: 'kora',
    fetchImpl: async () => { throw new Error('must not be called'); },
  });
  await assert.rejects(
    () => client.createIntent({ amountMinor: 7900, email: 'viewer@example.com' }),
    (error) => error instanceof IzakhonoPayError && error.code === 'misconfigured'
  );
});

test('server SDK surfaces fail-closed portal errors', async () => {
  const client = new IzakhonoPayClient({
    baseUrl: 'https://pay.example.test',
    apiKey: 'merchant-secret',
    appSlug: 'kora',
    fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: { code: 'unauthorized', message: 'Invalid merchant' } }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }),
  });
  await assert.rejects(
    () => client.createIntent({ amountMinor: 7900, email: 'viewer@example.com', idempotencyKey: 'order:kora:12345' }),
    (error) => error instanceof IzakhonoPayError && error.status === 401 && error.code === 'unauthorized'
  );
});
