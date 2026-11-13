import assert from 'node:assert/strict';
import { handleFortressCinematicGateway } from './fortress-cinematic-gateway';

const secret = 'fortress-test-session-secret-at-least-32-bytes';
const csrf = '0123456789abcdef0123456789abcdef0123456789abcdef';
const encoder = new TextEncoder();
function b64(value: string) { return btoa(value).split('=').join('').split('+').join('-').split('/').join('_'); }
async function token(role: 'OWNER' | 'VIEWER' = 'OWNER', tenantId = 'tenant-a') {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64(JSON.stringify({
    iss: 'https://fortress.izakhono.internal', aud: 'izakhono-creator',
    sub: 'user-123', tenant_id: tenantId, role, active: true,
    iat: now, exp: now + 600, jti: crypto.randomUUID(),
  }));
  const input = header + '.' + payload;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(input)));
  return input + '.' + b64(String.fromCharCode(...signature));
}
const identityBinding = {
  async fetch(request: Request) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\\s+/i, '') || '';
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return new Response(JSON.stringify({ valid: false }), { status: 401 });
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - payloadPart.length % 4) % 4);
    const claims = JSON.parse(atob(normalized)) as { sub: string; tenant_id: string; role: 'OWNER' | 'SECURITY_ADMIN' | 'ANALYST' | 'VIEWER'; exp: number };
    return new Response(JSON.stringify({ valid: true, principal: { id: claims.sub, tenantId: claims.tenant_id, role: claims.role }, expiresAt: claims.exp }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
};
const env = { FORTRESS_SESSION_HMAC_SECRET: secret, CREATOR_GENERATION_SECRET: 'creator-service-secret', FORTRESS_IDENTITY: identityBinding };

async function run() {
  const unrelated = await handleFortressCinematicGateway(new Request('https://creator.example/health'), env);
  assert.equal(unrelated, null, 'unrelated Creator routes remain with the canonical Worker');

  const unconfigured = await handleFortressCinematicGateway(new Request('https://creator.example/api/cinematic/session'), {});
  assert.equal(unconfigured?.status, 503, 'session verification fails closed when FORTRESS signing secret is absent');

  const signedWithoutAuthority = await token();
  const missingAuthority = await handleFortressCinematicGateway(new Request('https://creator.example/api/cinematic/session', {
    headers: { cookie: '__Host-izakhono_session=' + signedWithoutAuthority },
  }), { FORTRESS_SESSION_HMAC_SECRET: secret, CREATOR_GENERATION_SECRET: 'creator-service-secret' });
  assert.equal(missingAuthority?.status, 503, 'a valid JWT is not accepted when the live FORTRESS authority binding is missing');

  const anonymous = await handleFortressCinematicGateway(new Request('https://creator.example/api/cinematic/session'), env);
  assert.equal(anonymous?.status, 401, 'anonymous users cannot open a Creator session');

  const signed = await token();
  const session = await handleFortressCinematicGateway(new Request('https://creator.example/api/cinematic/session', {
    headers: { cookie: '__Host-izakhono_session=' + signed },
  }), env);
  assert.equal(session?.status, 200, 'valid FORTRESS session is accepted');
  const sessionData = await session!.json() as { authenticated: boolean; tenantId: string; role: string };
  assert.equal(sessionData.authenticated, true);
  assert.equal(sessionData.tenantId, 'tenant-a');
  assert.equal(sessionData.role, 'OWNER');

  const viewer = await token('VIEWER');
  const deniedWrite = await handleFortressCinematicGateway(new Request('https://creator.example/api/cinematic/projects', {
    method: 'POST', headers: { cookie: '__Host-izakhono_session=' + viewer + '; __Host-izakhono_csrf=' + csrf, 'x-csrf-token': csrf, origin: 'https://creator.example', 'content-type': 'application/json' },
    body: JSON.stringify({ brief: 'Private film' }),
  }), env);
  assert.equal(deniedWrite?.status, 403, 'viewer role cannot create a production');

  const missingCsrf = await handleFortressCinematicGateway(new Request('https://creator.example/api/cinematic/projects', {
    method: 'POST', headers: { cookie: '__Host-izakhono_session=' + signed, origin: 'https://creator.example', 'content-type': 'application/json' },
    body: JSON.stringify({ brief: 'Private film' }),
  }), env);
  assert.equal(missingCsrf?.status, 403, 'cookie-authenticated mutations require CSRF protection');

  const validCsrfButNoDb = await handleFortressCinematicGateway(new Request('https://creator.example/api/cinematic/projects', {
    method: 'POST', headers: { cookie: '__Host-izakhono_session=' + signed + '; __Host-izakhono_csrf=' + csrf, 'x-csrf-token': csrf, origin: 'https://creator.example', 'content-type': 'application/json' },
    body: JSON.stringify({ brief: 'Private film', ownerId: 'attacker', tenantId: 'tenant-attacker' }),
  }), env);
  assert.equal(validCsrfButNoDb?.status, 503, 'authenticated project creation still requires configured D1 persistence');

  const tampered = signed.slice(0, -2) + 'aa';
  const badSignature = await handleFortressCinematicGateway(new Request('https://creator.example/api/cinematic/session', {
    headers: { cookie: '__Host-izakhono_session=' + tampered },
  }), env);
  assert.equal(badSignature?.status, 401, 'tampered FORTRESS signatures are rejected');

  console.log('FORTRESS Cinematic Gateway tests: PASS');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
