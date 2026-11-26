import test from "node:test";
import assert from "node:assert/strict";
import { resolveCommerceAdmin } from "../src/fortress-auth.js";

const token = "a-valid-fortress-session-token-123456";
const principal = { id: "principal-1", tenantId: "tenant-1", role: "OWNER" };
function envFor(body, status = 200) {
  return { FORTRESS_IDENTITY: { fetch: async request => {
    assert.equal(request.url, "https://fortress.internal/api/fortress/session");
    assert.equal(request.headers.get("authorization"), `Bearer ${token}`);
    return new Response(JSON.stringify(body), { status });
  } } };
}
const request = () => new Request("https://commerce.test/admin", {
  headers: { authorization: `Bearer ${token}` }
});

test("accepts a live FORTRESS session with Commerce audience and owner role", async () => {
  const result = await resolveCommerceAdmin(request(), envFor({
    valid: true, audience: "izakhono-commerce", principal
  }));
  assert.deepEqual(result, { ok: true, principal });
});

test("rejects missing identity binding and missing bearer session", async () => {
  assert.equal((await resolveCommerceAdmin(request(), {})).code, "fortress_session_required");
  assert.equal((await resolveCommerceAdmin(new Request("https://commerce.test/admin"), envFor({}))).code, "fortress_session_required");
});

test("fails closed when FORTRESS is unavailable or rejects the session", async () => {
  const unavailable = { FORTRESS_IDENTITY: { fetch: async () => { throw new Error("offline"); } } };
  assert.equal((await resolveCommerceAdmin(request(), unavailable)).code, "fortress_identity_unavailable");
  assert.equal((await resolveCommerceAdmin(request(), envFor({ valid: false }, 401))).code, "fortress_session_invalid");
});

test("rejects a token issued for another service audience", async () => {
  const result = await resolveCommerceAdmin(request(), envFor({
    valid: true, audience: "izakhono-creator", principal
  }));
  assert.equal(result.code, "commerce_admin_permission_denied");
});

test("rejects analyst, viewer and incomplete tenant principals", async () => {
  for (const role of ["ANALYST", "VIEWER"]) {
    const result = await resolveCommerceAdmin(request(), envFor({
      valid: true, audience: "izakhono-commerce", principal: { ...principal, role }
    }));
    assert.equal(result.code, "commerce_admin_permission_denied");
  }
  const missingTenant = await resolveCommerceAdmin(request(), envFor({
    valid: true, audience: "izakhono-commerce", principal: { ...principal, tenantId: "" }
  }));
  assert.equal(missingTenant.code, "commerce_admin_permission_denied");
});
