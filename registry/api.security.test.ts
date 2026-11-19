import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { registryFetch } from "./api";

const xml = "<epp><command><hello/></command></epp>";
const protectedRequests: Request[] = [
  new Request("https://registry.test/registrar/create", { method: "POST", body: JSON.stringify({ id: "security-test-registrar", name: "Security Test" }) }),
  new Request("https://registry.test/domain/create", { method: "POST", headers: { "idempotency-key": "security-test-domain" }, body: JSON.stringify({ name: "example.test", registrarId: "security-test-registrar", registrantId: "security-test" }) }),
  new Request("https://registry.test/registration/order", { method: "POST", headers: { "idempotency-key": "security-test-order" }, body: JSON.stringify({ id: "security-test-order", domain: "example.test", registrarId: "security-test-registrar" }) }),
  new Request("https://registry.test/registration/order?id=security-test-order"),
  new Request("https://registry.test/registration/order/handover", { method: "POST", body: JSON.stringify({ id: "security-test-order" }) }),
  new Request("https://registry.test/domain/transition", { method: "POST", body: JSON.stringify({ name: "example.test", status: "pending" }) }),
  new Request("https://registry.test/epp", { method: "POST", body: xml, headers: { "content-type": "application/epp+xml", "x-registrar-id": "security-test-registrar" } }),
];

async function main() {
  for (const request of protectedRequests) {
    const missing = await registryFetch(request.clone(), undefined, { APP_ENV: "production" });
    assert.equal(missing.status, 401, `missing registry token hash must deny ${new URL(request.url).pathname}`);
    const empty = await registryFetch(request.clone(), undefined, { REGISTRY_TOKEN_SHA256: "" });
    assert.equal(empty.status, 401, `empty registry token hash must deny ${new URL(request.url).pathname}`);
  }

  const publicHealth = await registryFetch(new Request("https://registry.test/health"), undefined, { APP_ENV: "production" });
  assert.equal(publicHealth.status, 200, "health endpoint remains public");
  const publicCheck = await registryFetch(new Request("https://registry.test/domain/check?name=example.com"), undefined, {});
  assert.equal(publicCheck.status, 200, "read-only availability check remains public");

  const token = "registry-api-security-test-token";
  const hash = createHash("sha256").update(token).digest("hex");
  const authorized = await registryFetch(
    new Request("https://registry.test/registrar/create", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ id: "security-test-registrar", name: "Security Test" }),
    }),
    undefined,
    { REGISTRY_TOKEN_SHA256: hash },
  );
  assert.equal(authorized.status, 201, "configured valid bearer token permits authorized registrar creation");

  console.log("registry API security tests: ok (7 privileged routes fail closed; public read-only routes remain available; configured token accepted)");
}

void main();
