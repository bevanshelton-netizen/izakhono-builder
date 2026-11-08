import assert from 'node:assert/strict';
import { guardMobileApi, type MobileApiEnvironment } from './api-guard';

class FakeDB {
  prepare(sql: string) {
    let values: unknown[] = [];
    const self = this;
    return {
      bind(...args: unknown[]) { values = args; return this; },
      async first<T>() {
        if (sql.includes('FROM builder_customer_sessions')) {
          if (String(values[0]) === 'a'.repeat(64)) return {
            id: 'customer_01', email: 'test@example.invalid', display_name: 'Test',
            organization: 'IZAKHONO', status: 'active', session_id: 'session_01',
          } as T;
          return null;
        }
        if (sql.includes('INSERT INTO mobile_api_rate_limits')) {
          const count = (self as any).count = ((self as any).count || 0) + 1;
          return { request_count: count } as T;
        }
        return null;
      },
      async run() { return {}; },
    };
  }
}

function request(token?: string, headers: Record<string, string> = {}) {
  return new Request('https://api.example.test/mobile', {
    method: 'POST',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: '{}',
  });
}

async function main() {
  const env = { DB: new FakeDB(), ALLOWED_ORIGINS: 'https://app.example.test' } as unknown as MobileApiEnvironment;
  const unauthenticated = await guardMobileApi(request(), env);
  assert.equal(unauthenticated.ok, false);
  if (!unauthenticated.ok) assert.equal(unauthenticated.response.status, 401);

  const badOrigin = await guardMobileApi(request('a'.repeat(64), { origin: 'https://evil.example' }), env);
  assert.equal(badOrigin.ok, false);
  if (!badOrigin.ok) assert.equal(badOrigin.response.status, 403);

  const oversized = await guardMobileApi(request('a'.repeat(64), { 'content-length': String(70 * 1024) }), env);
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.equal(oversized.response.status, 413);

  const allowed = await guardMobileApi(request('a'.repeat(64)), env);
  assert.equal(allowed.ok, true);
  if (allowed.ok) assert.equal(allowed.identity.id, 'customer_01');

  const rateLimitedDb = new FakeDB();
  (rateLimitedDb as any).count = 30;
  const limited = await guardMobileApi(request('a'.repeat(64)), { ...env, DB: rateLimitedDb } as MobileApiEnvironment);
  assert.equal(limited.ok, false);
  if (!limited.ok) assert.equal(limited.response.status, 429);

  console.log('IZAKHONO Mobile Intelligence API guard tests passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
