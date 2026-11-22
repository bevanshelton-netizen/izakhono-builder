import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateDeploymentRequest,
  authorizeDeploymentAccess,
  DeploymentAuthorizationError
} from "./authorization.mjs";

const now = Date.parse("2026-11-22T10:00:00Z");
const resource = { tenantId: "tenant-a", applicationId: "app-a", environmentId: "staging" };
const validClaims = overrides => ({
  iss: "https://id.izakhono.example",
  aud: ["izakhono-deploy"],
  sub: "user-123",
  tenant_id: "tenant-a",
  application_ids: ["app-a"],
  environment_ids: ["staging"],
  scopes: ["deploy:read", "deploy:write"],
  exp: Math.floor(now / 1000) + 300,
  ...overrides
});
const authenticate = (claims = validClaims(), at = now) => authenticateDeploymentRequest({
  authorization: "Bearer signed-token",
  issuer: "https://id.izakhono.example",
  audience: "izakhono-deploy",
  now: at,
  verifyAccessToken: async token => {
    assert.equal(token, "signed-token");
    return claims;
  }
});

test("accepts a verified principal for its exact tenant, application and environment", async () => {
  const principal = await authenticate();
  assert.equal(authorizeDeploymentAccess(principal, resource, "read"), true);
  assert.equal(authorizeDeploymentAccess(principal, resource, "mutate"), true);
  assert.equal(principal.tenantId, "tenant-a");
});

test("rejects a caller-created principal even when its fields look valid", () => {
  assert.throws(
    () => authorizeDeploymentAccess({
      subject: "attacker", tenantId: "tenant-a", applicationIds: ["app-a"],
      environmentIds: ["staging"], scopes: ["deploy:admin"]
    }, resource, "mutate"),
    error => error instanceof DeploymentAuthorizationError && error.code === "PRINCIPAL_UNTRUSTED"
  );
});

test("rejects cross-tenant, cross-application and cross-environment access", async () => {
  const principal = await authenticate();
  for (const [override, code] of [
    [{ tenantId: "tenant-b" }, "TENANT_FORBIDDEN"],
    [{ applicationId: "app-b" }, "APPLICATION_FORBIDDEN"],
    [{ environmentId: "production" }, "ENVIRONMENT_FORBIDDEN"]
  ]) {
    assert.throws(
      () => authorizeDeploymentAccess(principal, { ...resource, ...override }, "read"),
      error => error.code === code
    );
  }
});

test("separates read, mutate and approval scopes", async () => {
  const principal = await authenticate(validClaims({ scopes: ["deploy:read"] }));
  assert.equal(authorizeDeploymentAccess(principal, resource, "read"), true);
  assert.throws(
    () => authorizeDeploymentAccess(principal, resource, "mutate"),
    error => error.code === "SCOPE_FORBIDDEN"
  );
  assert.throws(
    () => authorizeDeploymentAccess(principal, resource, "approve"),
    error => error.code === "SCOPE_FORBIDDEN"
  );
});

test("rejects absent bearer credentials and failed token verification", async () => {
  await assert.rejects(
    authenticateDeploymentRequest({ issuer: "issuer", audience: "aud", verifyAccessToken: async () => ({}) }),
    error => error.code === "AUTHENTICATION_REQUIRED"
  );
  await assert.rejects(
    authenticateDeploymentRequest({
      authorization: "Bearer bad", issuer: "issuer", audience: "aud",
      verifyAccessToken: async () => { throw new Error("bad signature"); }
    }),
    error => error.code === "TOKEN_INVALID"
  );
});

test("rejects expired tokens, wrong issuer/audience and incomplete scope claims", async () => {
  for (const overrides of [
    { exp: Math.floor(now / 1000) },
    { nbf: Math.floor(now / 1000) + 60 },
    { iss: "https://attacker.example" },
    { aud: ["other-service"] },
    { tenant_id: "" },
    { application_ids: [] },
    { environment_ids: [] },
    { scopes: [] }
  ]) {
    await assert.rejects(
      authenticate(validClaims(overrides)),
      error => error.code === "TOKEN_CLAIMS_INVALID"
    );
  }
});

test("does not allow a principal to be reused after token expiry", async () => {
  const expired = await authenticate(validClaims({ exp: 1 }), 0);
  assert.throws(
    () => authorizeDeploymentAccess(expired, resource, "read"),
    error => error.code === "PRINCIPAL_EXPIRED"
  );
});

test("rejects missing resource scope and unknown actions", async () => {
  const principal = await authenticate();
  assert.throws(
    () => authorizeDeploymentAccess(principal, { tenantId: "tenant-a" }, "read"),
    error => error.code === "RESOURCE_SCOPE_REQUIRED"
  );
  assert.throws(
    () => authorizeDeploymentAccess(principal, resource, "execute-shell"),
    error => error.code === "ACTION_INVALID"
  );
});
