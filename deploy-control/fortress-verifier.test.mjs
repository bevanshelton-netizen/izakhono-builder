import test from "node:test";
import assert from "node:assert/strict";
import { createFortressAccessTokenVerifier } from "./fortress-verifier.mjs";
import { authenticateDeploymentRequest, authorizeDeploymentAccess } from "./authorization.mjs";

const now = Date.now();
const nowSeconds = Math.floor(now / 1000);
const claims = {
  iss: "https://fortress.izakhono.internal",
  aud: "izakhono-deploy",
  sub: "operator-1",
  tenant_id: "tenant-1",
  application_ids: ["kora-network"],
  environment_ids: ["staging"],
  scopes: ["deploy:read", "deploy:write"],
  iat: nowSeconds - 10,
  nbf: nowSeconds - 10,
  exp: nowSeconds + 240,
  jti: "deploy-capability-123"
};
const endpoint = "https://fortress.example.net/api/fortress/deploy-token/introspect";
const secret = "ci-only-internal-secret-".padEnd(48, "s");
const token = "x".repeat(48);

test("accepts only the FORTRESS live-session introspection response", async () => {
  let observed;
  const verify = createFortressAccessTokenVerifier({
    introspectionUrl: endpoint,
    introspectionSecret: secret,
    fetchImpl: async (url, options) => {
      observed = { url: String(url), options };
      return new Response(JSON.stringify({ valid: true, sessionActive: true, claims }), {
        status: 200, headers: { "content-type": "application/json" }
      });
    }
  });
  const principal = await authenticateDeploymentRequest({
    authorization: "Bearer " + token,
    issuer: claims.iss,
    audience: claims.aud,
    now,
    verifyAccessToken: verify
  });
  assert.equal(observed.url, endpoint);
  assert.equal(observed.options.method, "POST");
  assert.equal(observed.options.headers.authorization, "Bearer " + token);
  assert.equal(observed.options.headers["x-fortress-internal-secret"], secret);
  assert.equal(observed.options.cache, "no-store");
  assert.equal(observed.options.redirect, "error");
  assert.equal(authorizeDeploymentAccess(principal, {
    tenantId: "tenant-1", applicationId: "kora-network", environmentId: "staging"
  }, "mutate"), true);
});

test("returns null for an invalid/revoked token and treats endpoint or secret failures as unavailable", async () => {
  const invalid = createFortressAccessTokenVerifier({
    introspectionUrl: endpoint,
    introspectionSecret: secret,
    fetchImpl: async () => new Response(JSON.stringify({ valid: false }), { status: 401 })
  });
  assert.equal(await invalid(token), null);

  const forbidden = createFortressAccessTokenVerifier({
    introspectionUrl: endpoint,
    introspectionSecret: secret,
    fetchImpl: async () => new Response("forbidden", { status: 403 })
  });
  await assert.rejects(forbidden(token), error => error.code === "IDENTITY_VERIFIER_UNAVAILABLE");

  const offline = createFortressAccessTokenVerifier({
    introspectionUrl: endpoint,
    introspectionSecret: secret,
    fetchImpl: async () => { throw new Error("network details must not escape"); }
  });
  await assert.rejects(offline(token), error => error.code === "IDENTITY_VERIFIER_UNAVAILABLE");
});

test("rejects non-HTTPS, wrong-path and weak-secret configuration", () => {
  assert.throws(() => createFortressAccessTokenVerifier({
    introspectionUrl: "http://fortress.example.net/api/fortress/deploy-token/introspect",
    introspectionSecret: secret
  }), /HTTPS/);
  assert.throws(() => createFortressAccessTokenVerifier({
    introspectionUrl: "https://fortress.example.net/api/fortress/session",
    introspectionSecret: secret
  }), /HTTPS/);
  assert.throws(() => createFortressAccessTokenVerifier({
    introspectionUrl: endpoint,
    introspectionSecret: "short"
  }), /configuration/);
});
