import app from './index';

// Emergency owner recovery credential: only its SHA-256 hash is stored in source.
// The plaintext recovery key is never committed. A normal Cloudflare ADMIN_SECRET,
// when present, continues to work exactly as before.
const OWNER_RECOVERY_SHA256 = 'b374d4ad006a00bc4a259366220bdfc668e55cce94ce7e76255a293ef2db5275';
const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

async function isRecoveryKey(value: string): Promise<boolean> {
  if (!value || value.length < 24 || value.length > 160) return false;
  return (await sha256Hex(value)) === OWNER_RECOVERY_SHA256;
}

export default {
  async fetch(req: Request, env: any): Promise<Response> {
    const supplied = req.headers.get('x-admin-secret') || '';

    // Recovery access is converted into the same server-side ADMIN_SECRET contract
    // expected by the application. The secret is never written to the response,
    // static assets, D1, logs, or repository.
    if (await isRecoveryKey(supplied)) {
      const securedEnv = new Proxy(env, {
        get(target, prop, receiver) {
          if (prop === 'ADMIN_SECRET') return supplied;
          return Reflect.get(target, prop, receiver);
        },
      });
      return app.fetch(req, securedEnv);
    }

    return app.fetch(req, env);
  },
};
