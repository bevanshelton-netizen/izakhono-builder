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

Deno.test("accepts a valid active canonical entity session", () => {
  const result = parseIdentityIntrospection(valid, Date.parse("2026-11-20T00:00:00Z"));
  if (!result || result.entityId !== valid.entity_id ||
      result.membershipId !== valid.membership_id ||
      result.userId !== valid.user_id) throw new Error("valid session was not accepted");
});

Deno.test("rejects inactive or revoked sessions", () => {
  if (parseIdentityIntrospection({ ...valid, active: false }) !== null) {
    throw new Error("inactive session was accepted");
  }
});

Deno.test("rejects malformed or missing canonical identifiers", () => {
  if (parseIdentityIntrospection({ ...valid, entity_id: "entity-from-request" }) !== null) {
    throw new Error("malformed entity ID was accepted");
  }
  if (parseIdentityIntrospection({ ...valid, membership_id: "" }) !== null) {
    throw new Error("missing membership ID was accepted");
  }
});

Deno.test("rejects expired canonical sessions", () => {
  if (parseIdentityIntrospection(valid, Date.parse("2027-01-02T00:00:00Z")) !== null) {
    throw new Error("expired session was accepted");
  }
});

Deno.test("CORS allows only exact configured origins", () => {
  const allowed = ["https://pay.izakhono.africa", "https://id.izakhono.africa"];
  if (!isAllowedOrigin("https://pay.izakhono.africa", allowed)) throw new Error("approved origin rejected");
  if (isAllowedOrigin("https://evil.example", allowed)) throw new Error("unapproved origin accepted");
  if (!isAllowedOrigin(null, allowed)) throw new Error("server-to-server request rejected");
});

Deno.test("product access requires a server-side product-to-entity binding", () => {
  const map = JSON.stringify({
    IZAKHONO_PAY: ["ent_0123456789abcdef0123456789abcdef"],
  });
  if (!productEntityAllowed(map, "IZAKHONO_PAY", "ent_0123456789abcdef0123456789abcdef")) {
    throw new Error("configured product/entity binding rejected");
  }
  if (productEntityAllowed(map, "IZAKHONO_PAY", "ent_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")) {
    throw new Error("cross-entity product binding accepted");
  }
  if (productEntityAllowed("", "IZAKHONO_PAY", "ent_0123456789abcdef0123456789abcdef")) {
    throw new Error("missing product map was accepted");
  }
});
