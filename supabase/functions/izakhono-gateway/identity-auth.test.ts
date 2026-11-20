import test from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedOrigin,
  parseIdentityIntrospection,
  productEntityAllowed,
} from "./identity-auth.ts";

const valid = {
  ok: true,
  active: true,
  user_id: "usr_0123456789abcdef0123456789abcdef",
  entity_id: "ent_0123456789abcdef0123456789abcdef",
  entity_slug: "izakhono-pay",
  membership_id: "mem_0123456789abcdef0123456789abcdef",
  session_id: "ses_0123456789abcdef0123456789abcdef",
  role: "admin",
  expires_at: "2027-01-01T00:00:00.000Z",
};

test("accepts a valid active canonical entity session", () => {
  const result = parseIdentityIntrospection(valid, Date.parse("2026-11-20T00:00:00Z"));
  assert.ok(result);
  assert.equal(result.entityId, valid.entity_id);
  assert.equal(result.membershipId, valid.membership_id);
  assert.equal(result.userId, valid.user_id);
});

test("rejects inactive or revoked sessions", () => {
  assert.equal(parseIdentityIntrospection({ ...valid, active: false }), null);
});

test("rejects malformed or missing canonical identifiers", () => {
  assert.equal(parseIdentityIntrospection({ ...valid, entity_id: "entity-from-request" }), null);
  assert.equal(parseIdentityIntrospection({ ...valid, membership_id: "" }), null);
});

test("rejects expired canonical sessions", () => {
  assert.equal(parseIdentityIntrospection(valid, Date.parse("2027-01-02T00:00:00Z")), null);
});

test("CORS allows only exact configured origins", () => {
  const allowed = ["https://pay.izakhono.africa", "https://id.izakhono.africa"];
  assert.equal(isAllowedOrigin("https://pay.izakhono.africa", allowed), true);
  assert.equal(isAllowedOrigin("https://evil.example", allowed), false);
  assert.equal(isAllowedOrigin(null, allowed), true);
});

test("product access requires a server-side product-to-entity binding", () => {
  const map = JSON.stringify({
    IZAKHONO_PAY: ["ent_0123456789abcdef0123456789abcdef"],
  });
  assert.equal(
    productEntityAllowed(map, "IZAKHONO_PAY", "ent_0123456789abcdef0123456789abcdef"),
    true,
  );
  assert.equal(
    productEntityAllowed(map, "IZAKHONO_PAY", "ent_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    false,
  );
  assert.equal(
    productEntityAllowed("", "IZAKHONO_PAY", "ent_0123456789abcdef0123456789abcdef"),
    false,
  );
});
