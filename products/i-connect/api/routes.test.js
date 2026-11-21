const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const registerRoutes = require('./routes');

async function withServer(run) {
  const app = express();
  app.use(express.json());
  registerRoutes(app);
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('checkout intent route rejects unauthenticated callers', async () => {
  await withServer(async (base) => {
    const response = await fetch(base + '/api/checkout-intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productCode: 'ANY', customerName: 'Test', customerEmail: 'test@example.com' })
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'authentication_required');
  });
});

test('checkout state route rejects unauthenticated callers', async () => {
  await withServer(async (base) => {
    const response = await fetch(base + '/api/checkout-state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutIntentId: '00000000-0000-4000-8000-000000000000' })
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'authentication_required');
  });
});

test('public provider-attempt route is permanently disabled', async () => {
  await withServer(async (base) => {
    const response = await fetch(base + '/api/provider-attempt', { method: 'POST' });
    assert.equal(response.status, 410);
    assert.equal((await response.json()).error, 'provider_attempt_endpoint_disabled');
  });
});

test('checkout intent route rejects unsupported methods', async () => {
  await withServer(async (base) => {
    const response = await fetch(base + '/api/checkout-intent');
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
  });
});
