/** FORTRESS-issued, short-lived, resource-scoped DEPLOY capabilities. */

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<{ success: boolean; meta?: { changes?: number }; results?: T[] }>;
}
export interface D1Database { prepare(sql: string): D1Statement }
export interface DeployAccessEnv {
  DB: D1Database;
  FORTRESS_SESSION_HMAC_SECRET: string;
  FORTRESS_SESSION_ISSUER?: string;
  FORTRESS_SESSION_AUDIENCE?: string;
  FORTRESS_ALLOWED_ORIGINS?: string;
  FORTRESS_DEPLOY_AUDIENCE?: string;
  FORTRESS_DEPLOY_INTROSPECTION_SECRET?: string;
  FORTRESS_DEPLOY_ACCESS_TTL_SECONDS?: string;
}
type Principal = {
  id: string; tenant_id: string; email: string; display_name: string;
  role: "OWNER" | "SECURITY_ADMIN" | "ANALYST" | "VIEWER"; active: number;
};
type Claims = Record<string, unknown> & {
  iss: string; aud: string; sub: string; tenant_id: string;
  iat: number; nbf: number; exp: number; jti: string;
};

const enc = new TextEncoder();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, max-age=0",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  }
});
const b64 = (bytes: Uint8Array) => btoa(Array.from(bytes, value => String.fromCharCode(value)).join(""))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const un64 = (value: string) => Uint8Array.from(
  atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)),
  character => character.charCodeAt(0)
);
const randomId = (bytes = 24) => {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return b64(value);
};
const sha256 = async (value: string) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const validResourceId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const bearer = (request: Request) => request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] || "";
const issuer = (env: DeployAccessEnv) => env.FORTRESS_SESSION_ISSUER || "https://fortress.izakhono.internal";
const creatorAudience = (env: DeployAccessEnv) => env.FORTRESS_SESSION_AUDIENCE || "izakhono-creator";
const deployAudience = (env: DeployAccessEnv) => env.FORTRESS_DEPLOY_AUDIENCE || "izakhono-deploy";

function originAllowed(request: Request, env: DeployAccessEnv): boolean {
  const origin = request.headers.get("origin");
  const allowed = (env.FORTRESS_ALLOWED_ORIGINS || new URL(request.url).origin)
    .split(",").map(value => value.trim()).filter(Boolean);
  return Boolean(origin && allowed.includes(origin));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function readJsonLimited(request: Request, maxBytes = 4096): Promise<Record<string, unknown> | null> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;
  const text = await request.text();
  if (enc.encode(text).byteLength > maxBytes) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

async function signClaims(claims: Claims, env: DeployAccessEnv): Promise<string> {
  const secret = env.FORTRESS_SESSION_HMAC_SECRET || "";
  if (enc.encode(secret).byteLength < 32) throw new Error("FORTRESS signing secret is unavailable");
  const header = b64(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64(enc.encode(JSON.stringify(claims)));
  const input = header + "." + payload;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return input + "." + b64(new Uint8Array(signature));
}

async function verifySignedClaims(
  token: string,
  env: DeployAccessEnv,
  expectedAudience: string,
  now: number,
  maxLifetimeSeconds: number
): Promise<Claims | null> {
  if (!token || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(un64(parts[0]))) as { alg?: string; typ?: string };
    const claims = JSON.parse(new TextDecoder().decode(un64(parts[1]))) as Claims;
    const issuedAt = claims.iat;
    const notBefore = claims.nbf;
    const expiresAt = claims.exp;
    if (header.alg !== "HS256" || (header.typ && header.typ !== "JWT") ||
        claims.iss !== issuer(env) || claims.aud !== expectedAudience ||
        !nonEmpty(claims.sub) || !nonEmpty(claims.jti) ||
        !Number.isInteger(issuedAt) || !Number.isInteger(notBefore) || !Number.isInteger(expiresAt) ||
        issuedAt > now + 60 || notBefore > now + 60 || expiresAt <= now ||
        expiresAt <= issuedAt || expiresAt - issuedAt > maxLifetimeSeconds) return null;
    const secret = env.FORTRESS_SESSION_HMAC_SECRET || "";
    if (enc.encode(secret).byteLength < 32) return null;
    const key = await crypto.subtle.importKey("raw", enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, un64(parts[2]), enc.encode(parts[0] + "." + parts[1]));
    return valid ? claims : null;
  } catch {
    return null;
  }
}

async function verifyCreatorSession(
  token: string,
  env: DeployAccessEnv,
  now: number
): Promise<{ claims: Claims; principal: Principal } | null> {
  const claims = await verifySignedClaims(token, env, creatorAudience(env), now, 900);
  if (!claims) return null;
  const principal = await env.DB.prepare(
    `SELECT p.id, p.tenant_id, p.email, p.display_name, p.role, p.active
       FROM refresh_sessions s
       JOIN principals p ON p.id = s.principal_id
      WHERE s.access_jti = ?
        AND s.principal_id = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > ?
      LIMIT 1`
  ).bind(claims.jti, claims.sub, now).first<Principal>();
  if (!principal || principal.active !== 1 || !nonEmpty(principal.tenant_id)) return null;
  return { claims, principal };
}

async function audit(
  env: DeployAccessEnv,
  event: string,
  principal: Principal,
  request: Request,
  metadata: Record<string, unknown>
): Promise<void> {
  const ip = request.headers.get("cf-connecting-ip");
  await env.DB.prepare(
    `INSERT INTO security_audit
      (id, event, principal_id, tenant_id, ip_hash, occurred_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), event, principal.id, principal.tenant_id,
    ip ? await sha256(ip) : null, Math.floor(Date.now() / 1000),
    JSON.stringify(metadata)
  ).run();
}

function validScopes(value: unknown, role: Principal["role"]): string[] | null {
  const allowed = role === "OWNER"
    ? new Set(["deploy:read", "deploy:write", "deploy:approve"])
    : new Set(["deploy:read", "deploy:write"]);
  if (!Array.isArray(value) || value.length < 1 || value.length > 3 ||
      !value.every(item => typeof item === "string" && allowed.has(item)) ||
      new Set(value).size !== value.length) return null;
  return [...value].sort();
}

/** Issue a short-lived capability for one application/environment under the caller's tenant. */
export async function issueDeployAccessToken(request: Request, env: DeployAccessEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!originAllowed(request, env)) return json({ error: "Origin not allowed" }, 403);
  const creatorToken = bearer(request);
  if (!creatorToken) return json({ error: "FORTRESS bearer session required" }, 401);
  const now = Math.floor(Date.now() / 1000);
  const session = await verifyCreatorSession(creatorToken, env, now);
  if (!session) return json({ error: "FORTRESS session is invalid or inactive" }, 401);
  const principal = session.principal;
  if (principal.role !== "OWNER" && principal.role !== "SECURITY_ADMIN") {
    return json({ error: "Deployment capability issuance is restricted to FORTRESS owners and security administrators" }, 403);
  }

  const body = await readJsonLimited(request);
  if (!body || !validResourceId(body.applicationId) || !validResourceId(body.environmentId)) {
    return json({ error: "Valid applicationId and environmentId are required" }, 400);
  }
  const scopes = validScopes(body.scopes, principal.role);
  if (!scopes) return json({ error: "Requested deployment scopes are invalid or exceed the caller's role" }, 403);

  const configuredTtl = Number(env.FORTRESS_DEPLOY_ACCESS_TTL_SECONDS || 300);
  if (!Number.isInteger(configuredTtl) || configuredTtl < 60 || configuredTtl > 300) {
    return json({ error: "DEPLOY access-token TTL configuration is invalid" }, 503);
  }
  const expiresAt = now + configuredTtl;
  const jti = randomId(24);
  const audience = deployAudience(env);
  const claims: Claims = {
    iss: issuer(env),
    aud: audience,
    sub: principal.id,
    tenant_id: principal.tenant_id,
    application_ids: [body.applicationId],
    environment_ids: [body.environmentId],
    scopes,
    iat: now,
    nbf: now,
    exp: expiresAt,
    jti,
    parent_jti: session.claims.jti
  };

  try {
    const token = await signClaims(claims, env);
    const inserted = await env.DB.prepare(
      `INSERT INTO deploy_access_sessions
        (jti, parent_access_jti, principal_id, tenant_id, application_id,
         environment_id, scopes_json, issued_at, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    ).bind(
      jti, session.claims.jti, principal.id, principal.tenant_id,
      body.applicationId, body.environmentId, JSON.stringify(scopes), now, expiresAt
    ).run();
    if (!inserted.success) return json({ error: "Deployment capability could not be recorded" }, 503);
    await audit(env, "deploy.access.issued", principal, request, {
      application_id: body.applicationId,
      environment_id: body.environmentId,
      scopes,
      jti_hash: await sha256(jti)
    });
    return json({
      access_token: token,
      token_type: "Bearer",
      expires_at: expiresAt,
      application_id: body.applicationId,
      environment_id: body.environmentId,
      scopes
    }, 201);
  } catch {
    return json({ error: "Deployment capability issuance failed" }, 503);
  }
}

/** Internal DEPLOY verifier. It validates signature and the live D1 session in one operation. */
export async function introspectDeployAccessToken(request: Request, env: DeployAccessEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const expectedSecret = env.FORTRESS_DEPLOY_INTROSPECTION_SECRET || "";
  const suppliedSecret = request.headers.get("x-fortress-internal-secret") || "";
  if (enc.encode(expectedSecret).byteLength < 32 || !constantTimeEqual(suppliedSecret, expectedSecret)) {
    return json({ valid: false }, 403);
  }
  const token = bearer(request);
  const now = Math.floor(Date.now() / 1000);
  const claims = await verifySignedClaims(token, env, deployAudience(env), now, 300);
  if (!claims || !nonEmpty(claims.tenant_id) || !nonEmpty(claims.parent_jti) ||
      !Array.isArray(claims.application_ids) || claims.application_ids.length !== 1 ||
      !Array.isArray(claims.environment_ids) || claims.environment_ids.length !== 1 ||
      !Array.isArray(claims.scopes) || !claims.scopes.every(scope => typeof scope === "string")) {
    return json({ valid: false }, 401);
  }

  const row = await env.DB.prepare(
    `SELECT d.jti, d.parent_access_jti, d.principal_id, d.tenant_id,
            d.application_id, d.environment_id, d.scopes_json, d.issued_at,
            d.expires_at, d.revoked_at, p.active, p.tenant_id AS principal_tenant_id,
            s.revoked_at AS parent_revoked_at, s.expires_at AS parent_expires_at
       FROM deploy_access_sessions d
       JOIN principals p ON p.id = d.principal_id
       JOIN refresh_sessions s
         ON s.access_jti = d.parent_access_jti
        AND s.principal_id = d.principal_id
      WHERE d.jti = ?
        AND d.principal_id = ?
      LIMIT 1`
  ).bind(claims.jti, claims.sub).first<Record<string, unknown>>();
  if (!row || row.revoked_at !== null || Number(row.expires_at) <= now ||
      row.parent_revoked_at !== null || Number(row.parent_expires_at) <= now ||
      row.active !== 1 || row.tenant_id !== row.principal_tenant_id ||
      claims.tenant_id !== row.tenant_id || claims.parent_jti !== row.parent_access_jti ||
      claims.application_ids[0] !== row.application_id ||
      claims.environment_ids[0] !== row.environment_id ||
      claims.iat !== Number(row.issued_at) || claims.exp !== Number(row.expires_at)) {
    return json({ valid: false }, 401);
  }

  let storedScopes: unknown;
  try { storedScopes = JSON.parse(String(row.scopes_json)); } catch { return json({ valid: false }, 401); }
  const claimScopes = [...claims.scopes].sort();
  if (!Array.isArray(storedScopes) || storedScopes.some(scope => typeof scope !== "string") ||
      JSON.stringify([...storedScopes].sort()) !== JSON.stringify(claimScopes)) {
    return json({ valid: false }, 401);
  }
  return json({ valid: true, sessionActive: true, claims });
}

/** Revoke a previously issued capability. Owners can revoke tenant capabilities; security admins their own. */
export async function revokeDeployAccessToken(request: Request, env: DeployAccessEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!originAllowed(request, env)) return json({ error: "Origin not allowed" }, 403);
  const creatorToken = bearer(request);
  if (!creatorToken) return json({ error: "FORTRESS bearer session required" }, 401);
  const now = Math.floor(Date.now() / 1000);
  const session = await verifyCreatorSession(creatorToken, env, now);
  if (!session) return json({ error: "FORTRESS session is invalid or inactive" }, 401);
  if (session.principal.role !== "OWNER" && session.principal.role !== "SECURITY_ADMIN") {
    return json({ error: "Capability revocation is restricted to FORTRESS owners and security administrators" }, 403);
  }
  const body = await readJsonLimited(request);
  if (!body || !nonEmpty(body.jti) || body.jti.length > 128) {
    return json({ error: "A valid deployment capability JTI is required" }, 400);
  }
  const row = await env.DB.prepare(
    `SELECT jti, principal_id, tenant_id
       FROM deploy_access_sessions
      WHERE jti = ? AND tenant_id = ?
      LIMIT 1`
  ).bind(body.jti, session.principal.tenant_id).first<Record<string, unknown>>();
  if (!row) return json({ error: "Deployment capability not found" }, 404);
  if (session.principal.role !== "OWNER" && row.principal_id !== session.principal.id) {
    return json({ error: "Security administrators may revoke only their own capabilities" }, 403);
  }
  const result = await env.DB.prepare(
    `UPDATE deploy_access_sessions
        SET revoked_at = ?
      WHERE jti = ? AND tenant_id = ? AND revoked_at IS NULL`
  ).bind(now, body.jti, session.principal.tenant_id).run();
  if ((result.meta?.changes || 0) !== 1) return json({ error: "Capability is already revoked or unavailable" }, 409);
  await audit(env, "deploy.access.revoked", session.principal, request, {
    jti_hash: await sha256(body.jti)
  });
  return json({ revoked: true });
}
