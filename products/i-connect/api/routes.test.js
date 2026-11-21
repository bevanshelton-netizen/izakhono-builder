const test = require('node:test');
const assert = require('node:assert/strict');
const registerRoutes = require('./routes');

function buildRegistry() {
  const routes = new Map();
  registerRoutes({ all(path, handler) { routes.set(path, handler); } });
  return routes;
}

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function invoke(routes, path, request) {
  const handler = routes.get(path);
  assert.ok(handler, `route not registered: ${path}`);
  const response = createResponse();
  await handler({ headers: {}, ...request }, response);
  return response;
}

test('owned runtime registers customer, provisioning and checkout endpoints', () => {
  const routes = buildRegistry();
  for (const path of [
    '/api/customer-control',
    '/api/provisioning',
    '/api/handover',
    '/api/checkout-intent',
    '/api/checkout-state',
    '/api/provider-attempt'
  ]) assert.ok(routes.has(path), `${path} should be registered`);
});

test('checkout intent route rejects unauthenticated callers', async () => {
  const response = await invoke(buildRegistry(), '/api/checkout-intent', {
    method: 'POST',
    body: { productCode: 'ANY', customerName: 'Test', customerEmail: 'test@example.com' }
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, 'authentication_required');
});

test('checkout state route rejects unauthenticated callers', async () => {
  const response = await invoke(buildRegistry(), '/api/checkout-state', {
    method: 'POST',
    body: { checkoutIntentId: '00000000-0000-4000-8000-000000000000' }
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, 'authentication_required');
});

test('public provider-attempt route is permanently disabled', async () => {
  const response = await invoke(buildRegistry(), '/api/provider-attempt', { method: 'POST' });
  assert.equal(response.statusCode, 410);
  assert.equal(response.body.error, 'provider_attempt_endpoint_disabled');
});

test('checkout intent route rejects unsupported methods', async () => {
  const response = await invoke(buildRegistry(), '/api/checkout-intent', { method: 'GET' });
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, 'POST');
});
