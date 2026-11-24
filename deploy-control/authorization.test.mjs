import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateDeploymentRequest,
  authorizeDeploymentAccess,
  createVerifiedAccessToken,
  DeploymentAuthorizationError
} from "./authorization.mjs";

const now = Date.now();
const nowSeconds = Math.floor(now / 1000);
const resource = { tenantId: "tenant-a", applicationId: "app-a", environmentId: "staging" };
const validClaims = overrides => ({
  iss: "https://fortress.izakhono.internal",
  aud: ["izakhono-deploy"],
  sub: "user-123",
  tenant_id: "tenant-a",
  application_ids: ["app-a"],
  environment_ids: ["staging"],
  scopes: ["deploy:read", "deploy:write"],
  iat: nowSeconds - 30,
  nbf: nowSeconds - 30,
  exp: nowSeconds + 300,
  jti: "session-token-123",
  ...overrides
});
const activeSession = (claims, overrides = {}) => ({
  active: true, jti: claims.jti, subject: claims.sub,
  tenantId: claims.tenant_id, expiresAt: claims.exp, ...overrides
});
const authenticate = (claims = validClaims(), options = {}) => authenticateDeploymentRequest({
  authorization: "Bearer signed-token",
  issuer: "https://fortress.izakhono.internal",
  audience: "izakhono-deploy",
  now,
  verifyAccessToken: async token => {
    assert.equal(token, "signed-token");
    return claims;
  },
  verifyActiveSession: async request => {
    assert.equal(request.jti, claims.jti);
    assert.equal(request.subject, claims.sub);
    assert.equal(request.tenantId, claims.tenant_id);
    return options.session === undefined ? activeSession(claims) : options.session;
  },
  ...options.config
});

test("accepts only a verified DEPLOY principal with a matching active JTI session", async () => {
  const principal = await authenticate();
  assert.equal(authorizeDeploymentAccess(principal, resource, "read"), true);
  assert.equal(authorizeDeploymentAccess(principal, resource, "mutate"), true);
  assert.equal(principal.tenantId, "tenant-a");
  assert.equal(principal.tokenId, "session-token-123");
});

test("rejects a caller-created principal even when its fields look valid", () => {
  assert.throws(() => authorizeDeploymentAccess({
    subject: "attacker", tenantId: "tenant-a", applicationIds: ["app-a"],
    environmentIds: ["staging"], scopes: ["deploy:admin"]
  }, resource, "mutate"), e => e.code === "PRINCIPAL_UNTRUSTED");
});

test("rejects cross-tenant, cross-application and cross-environment access", async () => {
  const principal = await authenticate();
  for (const [override, code] of [
    [{ tenantId: "tenant-b" }, "TENANT_FORBIDDEN"],
    [{ applicationId: "app-b" }, "APPLICATION_FORBIDDEN"],
    [{ environmentId: "production" }, "ENVIRONMENT_FORBIDDEN"]
  ]) {
    assert.throws(() => authorizeDeploymentAccess(principal, { ...resource, ...override }, "read"),
      error => error.code === code);
  }
});

test("separates read, mutate and approval scopes", async () => {
  const principal = await authenticate(validClaims({ scopes: ["deploy:read"] }));
  assert.equal(authorizeDeploymentAccess(principal, resource, "read"), true);
  assert.throws(() => authorizeDeploymentAccess(principal, resource, "mutate"), e => e.code === "SCOPE_FORBIDDEN");
  assert.throws(() => authorizeDeploymentAccess(principal, resource, "approve"), e => e.code === "SCOPE_FORBIDDEN");
});

test("rejects absent credentials and failed JWT verification", async () => {
  await assert.rejects(authenticateDeploymentRequest({
    issuer: "issuer", audience: "aud", verifyAccessToken: async () => ({}),
    verifyActiveSession: async () => ({})
  }), e => e.code === "AUTHENTICATION_REQUIRED");
  await assert.rejects(authenticateDeploymentRequest({
    authorization: "Bearer bad", issuer: "issuer", audience: "aud",
    verifyAccessToken: async () => { throw new Error("bad signature"); },
    verifyActiveSession: async () => ({})
  }), e => e.code === "TOKEN_INVALID");
});

test("requires iat, nbf, exp, jti and a maximum ten-minute lifetime", async () => {
  for (const overrides of [
    { iat: undefined }, { nbf: undefined }, { exp: undefined }, { jti: "" },
    { iat: nowSeconds + 1 }, { nbf: nowSeconds + 1 },
    { exp: nowSeconds }, { exp: nowSeconds + 601 }
  ]) {
    await assert.rejects(authenticate(validClaims(overrides)),
      e => e.code === "TOKEN_CLAIMS_INVALID");
  }
});

test("rejects wrong issuer/audience and incomplete entitlement claims", async () => {
  for (const overrides of [
    { iss: "https://attacker.example" }, { aud: ["izakhono-creator"] },
    { tenant_id: "" }, { application_ids: [] }, { environment_ids: [] }, { scopes: [] }
  ]) {
    await assert.rejects(authenticate(validClaims(overrides)),
      e => e.code === "TOKEN_CLAIMS_INVALID");
  }
});

test("rejects revoked, mismatched and expired live sessions", async () => {
  const claims = validClaims();
  for (const session of [
    activeSession(claims, { active: false }),
    activeSession(claims, { jti: "other-jti" }),
    activeSession(claims, { subject: "other-user" }),
    activeSession(claims, { tenantId: "tenant-b" }),
    activeSession(claims, { expiresAt: nowSeconds })
  ]) {
    await assert.rejects(authenticate(claims, { session }), e => e.code === "SESSION_INVALID");
  }
});

test("fails closed when live-session verification is unavailable", async () => {
  await assert.rejects(authenticateDeploymentRequest({
    authorization: "Bearer token", issuer: "https://fortress.izakhono.internal", audience: "izakhono-deploy",
    verifyAccessToken: async () => validClaims(),
    verifyActiveSession: async () => { throw new Error("identity unavailable"); }
  }), e => e.code === "SESSION_VERIFICATION_UNAVAILABLE");
});

test("rejects expired principals, missing scope and unknown actions", async () => {
  const principal = await authenticate();
  assert.throws(() => authorizeDeploymentAccess(principal, { tenantId: "tenant-a" }, "read"),
    e => e.code === "RESOURCE_SCOPE_REQUIRED");
  assert.throws(() => authorizeDeploymentAccess(principal, resource, "execute-shell"),
    e => e.code === "ACTION_INVALID");
});


test("accepts a trusted FORTRESS introspection result that already verified the live parent session", async () => {
  const claims = validClaims();
  const principal = await authenticateDeploymentRequest({
    authorization: "Bearer signed-token",
    issuer: "https://fortress.izakhono.internal",
    audience: "izakhono-deploy",
    now,
    verifyAccessToken: async () => createVerifiedAccessToken(claims, { sessionActive: true })
  });
  assert.equal(authorizeDeploymentAccess(principal, resource, "mutate"), true);
});

test("rejects inactive combined introspection and caller-forged verification wrappers", async () => {
  const claims = validClaims();
  await assert.rejects(authenticateDeploymentRequest({
    authorization: "Bearer signed-token",
    issuer: "https://fortress.izakhono.internal",
    audience: "izakhono-deploy",
    now,
    verifyAccessToken: async () => createVerifiedAccessToken(claims, { sessionActive: false })
  }), error => error.code === "SESSION_INVALID");

  await assert.rejects(authenticateDeploymentRequest({
    authorization: "Bearer signed-token",
    issuer: "https://fortress.izakhono.internal",
    audience: "izakhono-deploy",
    now,
    verifyAccessToken: async () => ({ claims, sessionActive: true })
  }), error => error.code === "AUTH_CONFIG_INVALID");
});
