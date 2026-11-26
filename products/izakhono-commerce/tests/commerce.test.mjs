import test from "node:test";
import assert from "node:assert/strict";
import worker, { validateOrderInput, validateProductInput } from "../src/index.js";

test("health endpoint works without a database", async () => {
  const response = await worker.fetch(new Request("https://commerce.test/health"), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.service, "izakhono-commerce");
  assert.equal(body.mode, "single-seller-core");
});

test("admin seller creation fails closed without a FORTRESS identity binding", async () => {
  const response = await worker.fetch(new Request("https://commerce.test/api/v1/admin/sellers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug: "acme", name: "Acme" })
  }), { DB: {} });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "fortress_session_required");
});

test("buyer order submission fails closed without buyer credential", async () => {
  const response = await worker.fetch(new Request("https://commerce.test/api/v1/orders", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "order-key-0001" },
    body: JSON.stringify({ seller_slug: "acme", items: [{ sku: "SKU-1", quantity: 1 }] })
  }), { DB: {} });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "buyer_access_required");
});

test("product validation accepts a safe published catalogue record", () => {
  const result = validateProductInput({
    seller_slug: "acme-industrial",
    sku: "PUMP-001",
    name: "Industrial Pump",
    description: "Sample catalogue item",
    currency: "zar",
    unit_price_minor: 125000,
    status: "published"
  });
  assert.equal(result.sellerSlug, "acme-industrial");
  assert.equal(result.currency, "ZAR");
  assert.equal(result.unitPriceMinor, 125000);
});

test("product validation rejects invalid seller slug and unsafe price", () => {
  assert.throws(() => validateProductInput({
    seller_slug: "../acme", sku: "SKU-1", name: "Item", currency: "ZAR", unit_price_minor: 100, status: "draft"
  }), /invalid_seller_slug/);
  assert.throws(() => validateProductInput({
    seller_slug: "acme", sku: "SKU-1", name: "Item", currency: "ZAR", unit_price_minor: 1.5, status: "draft"
  }), /invalid_unit_price/);
});

test("order validation aggregates duplicate SKUs and sorts deterministically", () => {
  const result = validateOrderInput({
    seller_slug: "acme",
    buyer_reference: "PO-100",
    items: [{ sku: "SKU-B", quantity: 2 }, { sku: "SKU-A", quantity: 3 }, { sku: "SKU-A", quantity: 1 }]
  });
  assert.deepEqual(result.items, [{ sku: "SKU-A", quantity: 4 }, { sku: "SKU-B", quantity: 2 }]);
});

test("order validation rejects zero, fractional and excessive quantities", () => {
  assert.throws(() => validateOrderInput({ seller_slug: "acme", items: [{ sku: "SKU-1", quantity: 0 }] }), /invalid_quantity/);
  assert.throws(() => validateOrderInput({ seller_slug: "acme", items: [{ sku: "SKU-1", quantity: 1.2 }] }), /invalid_quantity/);
  assert.throws(() => validateOrderInput({ seller_slug: "acme", items: [{ sku: "SKU-1", quantity: 1000001 }] }), /invalid_quantity/);
});

test("invalid JSON is rejected with a structured error", async () => {
  const response = await worker.fetch(new Request("https://commerce.test/api/v1/admin/sellers", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": "Bearer valid-session-token-123456" },
    body: "{"
  }), { DB: {}, FORTRESS_IDENTITY: { fetch: async () => new Response(JSON.stringify({ valid: true, audience: "izakhono-commerce", principal: { id: "principal-1", tenantId: "tenant-1", role: "OWNER" } }), { status: 200 }) } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "invalid_json");
});

test("unknown routes return a structured 404", async () => {
  const response = await worker.fetch(new Request("https://commerce.test/unknown"), {});
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "route_not_found");
});
