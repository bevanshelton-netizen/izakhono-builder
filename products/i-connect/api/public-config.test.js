const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./public-config');

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

test('public config exposes only the Supabase URL and public anon key', () => {
  const beforeUrl = process.env.I_CONNECT_SUPABASE_URL;
  const beforeKey = process.env.I_CONNECT_SUPABASE_ANON_KEY;
  const beforeServiceKey = process.env.I_CONNECT_SUPABASE_SERVICE_ROLE_KEY;
  try {
    process.env.I_CONNECT_SUPABASE_URL = 'https://example.supabase.co';
    process.env.I_CONNECT_SUPABASE_ANON_KEY = 'public-anon-test-key';
    process.env.I_CONNECT_SUPABASE_SERVICE_ROLE_KEY = 'never-return-this';
    const res = response();
    handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      service: 'I-CONNECT',
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'public-anon-test-key'
    });
    assert.equal(JSON.stringify(res.body).includes('never-return-this'), false);
    assert.equal(res.headers['cache-control'], 'no-store');
  } finally {
    if (beforeUrl === undefined) delete process.env.I_CONNECT_SUPABASE_URL;
    else process.env.I_CONNECT_SUPABASE_URL = beforeUrl;
    if (beforeKey === undefined) delete process.env.I_CONNECT_SUPABASE_ANON_KEY;
    else process.env.I_CONNECT_SUPABASE_ANON_KEY = beforeKey;
    if (beforeServiceKey === undefined) delete process.env.I_CONNECT_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.I_CONNECT_SUPABASE_SERVICE_ROLE_KEY = beforeServiceKey;
  }
});

test('public config fails closed when required public configuration is missing', () => {
  const beforeUrl = process.env.I_CONNECT_SUPABASE_URL;
  const beforeKey = process.env.I_CONNECT_SUPABASE_ANON_KEY;
  try {
    delete process.env.I_CONNECT_SUPABASE_URL;
    delete process.env.I_CONNECT_SUPABASE_ANON_KEY;
    const res = response();
    handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, 'authentication_not_configured');
  } finally {
    if (beforeUrl === undefined) delete process.env.I_CONNECT_SUPABASE_URL;
    else process.env.I_CONNECT_SUPABASE_URL = beforeUrl;
    if (beforeKey === undefined) delete process.env.I_CONNECT_SUPABASE_ANON_KEY;
    else process.env.I_CONNECT_SUPABASE_ANON_KEY = beforeKey;
  }
});

test('public config permits GET only', () => {
  const res = response();
  handler({ method: 'POST' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'GET');
});
