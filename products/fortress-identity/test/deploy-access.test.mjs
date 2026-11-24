import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  issueDeployAccessToken,
  introspectDeployAccessToken,
  revokeDeployAccessToken
} from "../src/deploy-access.ts";

globalThis.crypto ??= webcrypto;

const SECRET = "ci-only-fortress-hmac-secret-".padEnd(48, "x");
const INTERNAL_SECRET = "ci-only-deploy-introspection-secret-".padEnd(48, "y");
const ISSUER = "https://fortress.test.invalid";
const CREATOR_AUD = "izakhono-creator";
const DEPLOY_AUD = "izakhono-deploy";
const ORIGIN = "https://creator.test.invalid";

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function signJwt(claims) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const input = header + "." + payload;
  const key = await webcrypto.subtle.importKey(
    "raw", Buffer.from(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await webcrypto.subtle.sign("HMAC", key, Buffer.from(input));
  return input + "." + b64url(Buffer.from(signature));
}

function decodeClaims(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
}

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  first() { return this.db.first(this.sql, this.values); }
  run() { return this.db.run(this.sql, this.values); }
}

class FakeD1 {
  constructor(principal, parentSession) {
    this.principals = new Map([[principal.id, { ...principal }]]);
    this.refreshSessions = new Map([[parentSession.access_jti, { ...parentSession }]]);
    this.deploySessions = new Map();
    this.auditRows = [];
  }
  prepare(sql) { return new FakeStatement(this, sql); }
  async first(sql, values) {
    if (sql.includes("FROM deploy_access_sessions d")) {
      const [jti, principalId] = values;
      const row = this.deploySessions.get(jti);
      const principal = this.principals.get(principalId);
      const parent = row && this.refreshSessions.get(row.parent_access_jti);
      if (!row || row.principal_id !== principalId || !principal || !parent) return null;
      return {
        ...row,
        active: principal.active,
        principal_tenant_id: principal.tenant_id,
        parent_revoked_at: parent.revoked_at,
        parent_expires_at: parent.expires_at
      };
    }
    if (sql.includes("FROM deploy_access_sessions") && sql.includes("WHERE jti = ? AND tenant_id = ?")) {
      const [jti, tenantId] = values;
      const row = this.deploySessions.get(jti);
      if (!row || row.tenant_id !== tenantId) return null;
      return { jti: row.jti, principal_id: row.principal_id, tenant_id: row.tenant_id, revoked_at: row.revoked_at };
    }
    if (sql.includes("FROM refresh_sessions s JOIN principals p")) {
      const [jti, principalId, now] = values;
      const session = this.refreshSessions.get(jti);
      const principal = this.principals.get(principalId);
      if (!session || session.principal_id !== principalId || session.revoked_at !== null ||
          session.expires_at <= now || !principal) return null;
      return { ...principal };
    }
    return null;
  }
  async run(sql, values) {
    if (sql.includes("INSERT INTO deploy_access_sessions")) {
      const [jti, parentJti, principalId, tenantId, applicationId, environmentId, scopesJson, issuedAt, expiresAt] = values;
      if (this.deploySessions.has(jti)) return { success: true, meta: { changes: 0 } };
      this.deploySessions.set(jti, {
        jti, parent_access_jti: parentJti, principal_id: principalId, tenant_id: tenantId,
        application_id: applicationId, environment_id: environmentId, scopes_json: scopesJson,
        issued_at: issuedAt, expires_at: expiresAt, revoked_at: null, revocation_event_id: null
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes("INSERT INTO security_audit") && sql.includes("SELECT 1 FROM deploy_access_sessions")) {
      const [id, event, principalId, tenantId, ipHash, occurredAt, metadataJson, jti, scopeTenant, revokedAt, eventId] = values;
      const row = this.deploySessions.get(jti);
      if (!row || row.tenant_id !== scopeTenant || row.revoked_at !== revokedAt ||
          row.revocation_event_id !== eventId) return { success: true, meta: { changes: 0 } };
      this.auditRows.push({ id, event, principalId, tenantId, ipHash, occurredAt, metadataJson });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE deploy_access_sessions")) {
      const [revokedAt, eventId, jti, tenantId] = values;
      const row = this.deploySessions.get(jti);
      if (!row || row.tenant_id !== tenantId || row.revoked_at !== null) {
        return { success: true, meta: { changes: 0 } };
      }
      row.revoked_at = revokedAt;
      row.revocation_event_id = eventId;
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO security_audit")) {
      const [id, event, principalId, tenantId, ipHash, occurredAt, metadataJson] = values;
      this.auditRows.push({ id, event, principalId, tenantId, ipHash, occurredAt, metadataJson });
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 0 } };
  }
  async batch(statements) {
    const sessions = new Map([...this.deploySessions].map(([key, value]) => [key, { ...value }]));
    const audits = [...this.auditRows];
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    } catch (error) {
      this.deploySessions = sessions;
      this.auditRows = audits;
      throw error;
    }
  }
}

function makeEnv(role = "OWNER", overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const principal = {
    id: "principal-1", tenant_id: "tenant-1", email: "owner@example.invalid",
    display_name: "Test Owner", role, active: 1
  };
  const parentSession = {
    access_jti: "parent-access-jti", principal_id: principal.id,
    expires_at: now + 86400, revoked_at: null
  };
  const DB = new FakeD1(principal, parentSession);
  return {
    DB,
    FORTRESS_SESSION_HMAC_SECRET: SECRET,
    FORTRESS_SESSION_ISSUER: ISSUER,
    FORTRESS_SESSION_AUDIENCE: CREATOR_AUD,
    FORTRESS_ALLOWED_ORIGINS: ORIGIN,
    FORTRESS_DEPLOY_AUDIENCE: DEPLOY_AUD,
    FORTRESS_DEPLOY_INTROSPECTION_SECRET: INTERNAL_SECRET,
    FORTRESS_DEPLOY_ACCESS_TTL_SECONDS: "300",
    ...overrides
  };
}

async function creatorToken(role = "OWNER", tenantId = "tenant-1") {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    iss: ISSUER, aud: CREATOR_AUD, sub: "principal-1", tenant_id: tenantId,
    role, active: true, iat: now - 30, exp: now + 600, jti: "parent-access-jti"
  });
}

function issueRequest(token, body) {
  return new Request("https://fortress.test.invalid/api/fortress/deploy-token", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      origin: ORIGIN,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function introspectRequest(token, secret = INTERNAL_SECRET) {
  return new Request("https://fortress.test.invalid/api/fortress/deploy-token/introspect", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "x-fortress-internal-secret": secret
    }
  });
}

function revokeRequest(token, jti) {
  return new Request("https://fortress.test.invalid/api/fortress/deploy-token/revoke", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      origin: ORIGIN,
      "content-type": "application/json"
    },
    body: JSON.stringify({ jti })
  });
}

test("OWNER receives a one-resource DEPLOY token; introspection and revocation follow D1 state", async () => {
  const env = makeEnv();
  const ownerToken = await creatorToken();
  const issued = await issueDeployAccessToken(issueRequest(ownerToken, {
    applicationId: "kora-network",
    environmentId: "staging",
    scopes: ["deploy:read", "deploy:write", "deploy:approve"]
  }), env);
  assert.equal(issued.status, 201);
  const payload = await issued.json();
  assert.equal(payload.token_type, "Bearer");
  assert.equal(payload.application_id, "kora-network");
  assert.equal(payload.environment_id, "staging");
  assert.deepEqual(payload.scopes, ["deploy:approve", "deploy:read", "deploy:write"]);
  assert.equal(env.DB.deploySessions.size, 1);
  assert.equal(env.DB.auditRows.length, 1);

  const claims = decodeClaims(payload.access_token);
  assert.equal(claims.iss, ISSUER);
  assert.equal(claims.aud, DEPLOY_AUD);
  assert.equal(claims.sub, "principal-1");
  assert.equal(claims.tenant_id, "tenant-1");
  assert.deepEqual(claims.application_ids, ["kora-network"]);
  assert.deepEqual(claims.environment_ids, ["staging"]);
  assert.equal(claims.exp - claims.iat, 300);

  const introspected = await introspectDeployAccessToken(introspectRequest(payload.access_token), env);
  assert.equal(introspected.status, 200);
  const verified = await introspected.json();
  assert.equal(verified.valid, true);
  assert.equal(verified.sessionActive, true);
  assert.equal(verified.claims.jti, claims.jti);

  const revoked = await revokeDeployAccessToken(revokeRequest(ownerToken, claims.jti), env);
  assert.equal(revoked.status, 200);
  assert.equal((await revoked.json()).revoked, true);
  assert.equal(env.DB.auditRows.length, 2);

  const afterRevoke = await introspectDeployAccessToken(introspectRequest(payload.access_token), env);
  assert.equal(afterRevoke.status, 401);
  assert.equal((await afterRevoke.json()).valid, false);
});

test("SECURITY_ADMIN can issue write capabilities but cannot issue deploy:approve", async () => {
  const env = makeEnv("SECURITY_ADMIN");
  const token = await creatorToken("SECURITY_ADMIN");
  const denied = await issueDeployAccessToken(issueRequest(token, {
    applicationId: "app-1", environmentId: "production", scopes: ["deploy:approve"]
  }), env);
  assert.equal(denied.status, 403);
  assert.equal(env.DB.deploySessions.size, 0);

  const allowed = await issueDeployAccessToken(issueRequest(token, {
    applicationId: "app-1", environmentId: "staging", scopes: ["deploy:write"]
  }), env);
  assert.equal(allowed.status, 201);
});

test("non-privileged roles and cross-tenant stale sessions cannot issue DEPLOY tokens", async () => {
  const analystEnv = makeEnv("ANALYST");
  const analystToken = await creatorToken("ANALYST");
  const denied = await issueDeployAccessToken(issueRequest(analystToken, {
    applicationId: "app-1", environmentId: "staging", scopes: ["deploy:read"]
  }), analystEnv);
  assert.equal(denied.status, 403);

  const ownerEnv = makeEnv("OWNER");
  const staleTenantToken = await creatorToken("OWNER", "different-tenant");
  const staleTenant = await issueDeployAccessToken(issueRequest(staleTenantToken, {
    applicationId: "app-1", environmentId: "staging", scopes: ["deploy:write"]
  }), ownerEnv);
  assert.equal(staleTenant.status, 401);
});

test("introspection requires the separate internal secret and a live parent session", async () => {
  const env = makeEnv();
  const ownerToken = await creatorToken();
  const issued = await issueDeployAccessToken(issueRequest(ownerToken, {
    applicationId: "app-1", environmentId: "staging", scopes: ["deploy:write"]
  }), env);
  const payload = await issued.json();

  const wrongSecret = await introspectDeployAccessToken(introspectRequest(payload.access_token, "wrong-secret"), env);
  assert.equal(wrongSecret.status, 403);

  env.DB.refreshSessions.get("parent-access-jti").revoked_at = Math.floor(Date.now() / 1000);
  const parentRevoked = await introspectDeployAccessToken(introspectRequest(payload.access_token), env);
  assert.equal(parentRevoked.status, 401);
});
