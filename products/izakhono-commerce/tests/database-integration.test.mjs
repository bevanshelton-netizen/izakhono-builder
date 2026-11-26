import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";

function createD1Adapter() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(readFileSync(new URL("../migrations/0001_commerce_core.sql", import.meta.url), "utf8"));
  return {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        first() { return sqlite.prepare(sql).get(...values) ?? null; },
        all() { return { results: sqlite.prepare(sql).all(...values) }; },
        run() { return sqlite.prepare(sql).run(...values); }
      };
    },
    batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map(statement => statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    close() { sqlite.close(); }
  };
}

async function call(env, path, { method = "GET", headers = {}, body } = {}) {
  return worker.fetch(new Request(`https://commerce.test${path}`, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  }), env);
}

async function json(response) {
  return response.json();
}

test("database-backed B2B flow persists orders, replays idempotently and isolates buyers", async t => {
  const DB = createD1Adapter();
  t.after(() => DB.close());
  const env = {
    DB,
    FORTRESS_IDENTITY: {
      fetch: async request => request.headers.get("authorization") === "Bearer integration-fortress-session-token"
        ? new Response(JSON.stringify({ valid: true, audience: "izakhono-commerce", principal: { id: "principal-owner-1", tenantId: "tenant-acme", role: "OWNER" } }), { status: 200 })
        : new Response(JSON.stringify({ valid: false }), { status: 401 })
    }
  };
  const admin = { authorization: "Bearer integration-fortress-session-token" };

  const sellerResponse = await call(env, "/api/v1/admin/sellers", {
    method: "POST", headers: admin, body: { slug: "acme-industrial", name: "Acme Industrial" }
  });
  assert.equal(sellerResponse.status, 201);
  const seller = (await json(sellerResponse)).seller;

  const buyerAResponse = await call(env, "/api/v1/admin/buyers", {
    method: "POST", headers: admin, body: { seller_slug: "acme-industrial", organisation_name: "Buyer A Ltd" }
  });
  const buyerBResponse = await call(env, "/api/v1/admin/buyers", {
    method: "POST", headers: admin, body: { seller_slug: "acme-industrial", organisation_name: "Buyer B Ltd" }
  });
  assert.equal(buyerAResponse.status, 201);
  assert.equal(buyerBResponse.status, 201);
  const buyerA = (await json(buyerAResponse));
  const buyerB = (await json(buyerBResponse));
  assert.ok(buyerA.api_key);
  assert.ok(buyerB.api_key);
  assert.notEqual(buyerA.api_key, buyerB.api_key);

  const productResponse = await call(env, "/api/v1/admin/products", {
    method: "POST", headers: admin,
    body: { seller_slug: seller.slug, sku: "PUMP-001", name: "Industrial Pump", currency: "ZAR", unit_price_minor: 125000, status: "published" }
  });
  assert.equal(productResponse.status, 201);

  const catalogResponse = await call(env, "/api/v1/catalog/acme-industrial");
  assert.equal(catalogResponse.status, 200);
  const catalog = await json(catalogResponse);
  assert.equal(catalog.products.length, 1);
  assert.equal(catalog.products[0].unit_price_minor, 125000);

  const orderHeaders = {
    "x-izakhono-commerce-buyer-key": buyerA.api_key,
    "idempotency-key": "integration-order-0001"
  };
  const orderBody = {
    seller_slug: "acme-industrial",
    buyer_reference: "PO-1001",
    items: [{ sku: "PUMP-001", quantity: 2 }]
  };
  const firstResponse = await call(env, "/api/v1/orders", { method: "POST", headers: orderHeaders, body: orderBody });
  assert.equal(firstResponse.status, 201);
  const first = await json(firstResponse);
  assert.equal(first.order.subtotal_minor, 250000);
  assert.equal(first.order.payment_status, "pending");
  assert.equal(first.order.inventory_status, "awaiting_seller_confirmation");
  assert.equal(first.order.lines.length, 1);
  assert.equal(first.order.lines[0].line_total_minor, 250000);

  const replayResponse = await call(env, "/api/v1/orders", { method: "POST", headers: orderHeaders, body: orderBody });
  assert.equal(replayResponse.status, 200);
  const replay = await json(replayResponse);
  assert.equal(replay.replayed, true);
  assert.equal(replay.order.id, first.order.id);
  assert.equal(replay.order.lines.length, 1);

  const conflictResponse = await call(env, "/api/v1/orders", {
    method: "POST", headers: orderHeaders,
    body: { ...orderBody, items: [{ sku: "PUMP-001", quantity: 3 }] }
  });
  assert.equal(conflictResponse.status, 409);
  assert.equal((await json(conflictResponse)).error.code, "idempotency_conflict");

  const ownOrderResponse = await call(env, `/api/v1/orders/${first.order.id}`, {
    headers: { "x-izakhono-commerce-buyer-key": buyerA.api_key }
  });
  assert.equal(ownOrderResponse.status, 200);

  const otherBuyerResponse = await call(env, `/api/v1/orders/${first.order.id}`, {
    headers: { "x-izakhono-commerce-buyer-key": buyerB.api_key }
  });
  assert.equal(otherBuyerResponse.status, 404);
});

test("database constraints reject duplicate seller slugs and duplicate seller SKUs", async t => {
  const DB = createD1Adapter();
  t.after(() => DB.close());
  const env = {
    DB,
    FORTRESS_IDENTITY: {
      fetch: async () => new Response(JSON.stringify({ valid: true, audience: "izakhono-commerce", principal: { id: "principal-owner-2", tenantId: "tenant-unique", role: "OWNER" } }), { status: 200 })
    }
  };
  const headers = { authorization: "Bearer integration-fortress-session-token" };
  const createSeller = () => call(env, "/api/v1/admin/sellers", {
    method: "POST", headers, body: { slug: "unique-seller", name: "Unique Seller" }
  });
  assert.equal((await createSeller()).status, 201);
  assert.equal((await createSeller()).status, 409);

  const product = {
    seller_slug: "unique-seller", sku: "SKU-UNIQUE", name: "Unique Item",
    currency: "ZAR", unit_price_minor: 5000, status: "published"
  };
  assert.equal((await call(env, "/api/v1/admin/products", { method: "POST", headers, body: product })).status, 201);
  assert.equal((await call(env, "/api/v1/admin/products", { method: "POST", headers, body: product })).status, 409);
});
