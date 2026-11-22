const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./catalogue');

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('public catalogue returns the defined products without making them orderable', () => {
  const res = response();
  handler({ method: 'GET' }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.service, 'I-CONNECT Catalogue');
  assert.equal(res.body.market, 'ZA');
  assert.equal(res.body.status, 'DISCOVERY_CATALOGUE');
  assert.equal(res.body.orderable, false);
  assert.ok(res.body.products.length > 0);

  for (const product of res.body.products) {
    assert.ok(product.id && product.name);
    assert.ok(Array.isArray(product.deliveryModels));
    assert.equal(product.availability, 'NOT_VERIFIED');
    assert.equal(product.commercialStatus, 'PARTNER_ASSESSMENT_REQUIRED');
    assert.equal(product.orderable, false);
    assert.equal(product.price, null);
    assert.equal(product.currency, 'ZAR');
    assert.match(product.disclosure, /not been verified/i);
  }
});

test('catalogue does not invent prices, coverage, or live provider status', () => {
  const res = response();
  handler({ method: 'GET' }, res);
  const serialised = JSON.stringify(res.body);

  assert.doesNotMatch(serialised, /PRODUCTION_ELIGIBLE|LIVE|ACTIVE|R\s?\d/i);
  assert.doesNotMatch(serialised, /coverageVerified|providerActivated/);
});

test('catalogue rejects mutating methods', () => {
  const res = response();
  handler({ method: 'POST' }, res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'GET');
  assert.equal(res.body.error, 'method_not_allowed');
});
