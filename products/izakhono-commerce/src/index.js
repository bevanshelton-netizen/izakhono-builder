import { resolveCommerceAdmin } from "./fortress-auth.js";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }); }
function fail(status, code, message) { return json({ ok: false, error: { code, message } }, status); }
function makeId(prefix) { return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`; }
function safeText(value, max = 255) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validSlug(value) { return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(value); }
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function readJson(request) {
  const raw = await request.text();
  if (raw.length > 65536) throw new Error("payload_too_large");
  try { return JSON.parse(raw); } catch { throw new Error("invalid_json"); }
}
export function validateProductInput(body) {
  const sellerSlug = safeText(body?.seller_slug, 60).toLowerCase();
  const sku = safeText(body?.sku, 100);
  const name = safeText(body?.name, 180);
  const description = safeText(body?.description, 2000);
  const currency = safeText(body?.currency, 3).toUpperCase();
  const unitPriceMinor = body?.unit_price_minor;
  const status = body?.status === undefined ? "draft" : body.status;
  if (!validSlug(sellerSlug)) throw new Error("invalid_seller_slug");
  if (!sku || !/^[A-Za-z0-9._-]{1,100}$/.test(sku)) throw new Error("invalid_sku");
  if (!name) throw new Error("invalid_product_name");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("invalid_currency");
  if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor <= 0) throw new Error("invalid_unit_price");
  if (!["draft", "published"].includes(status)) throw new Error("invalid_product_status");
  return { sellerSlug, sku, name, description, currency, unitPriceMinor, status };
}
export function validateOrderInput(body) {
  const sellerSlug = safeText(body?.seller_slug, 60).toLowerCase();
  const buyerReference = safeText(body?.buyer_reference, 120);
  if (!validSlug(sellerSlug)) throw new Error("invalid_seller_slug");
  if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 500) throw new Error("invalid_order_items");
  const quantities = new Map();
  for (const item of body.items) {
    const sku = safeText(item?.sku, 100);
    const quantity = item?.quantity;
    if (!sku || !/^[A-Za-z0-9._-]{1,100}$/.test(sku)) throw new Error("invalid_sku");
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) throw new Error("invalid_quantity");
    const next = (quantities.get(sku) || 0) + quantity;
    if (!Number.isSafeInteger(next) || next > 1000000) throw new Error("invalid_quantity");
    quantities.set(sku, next);
  }
  const items = [...quantities.entries()].map(([sku, quantity]) => ({ sku, quantity })).sort((a, b) => a.sku.localeCompare(b.sku));
  return { sellerSlug, buyerReference, items };
}
async function requireDb(env) { if (!env.DB) throw new Error("database_unavailable"); return env.DB; }
async function createSeller(request, env) {
  const auth = await resolveCommerceAdmin(request, env);
  if (!auth.ok) return fail(auth.status, auth.code, "A valid FORTRESS administrator session is required.");
  const body = await readJson(request);
  const slug = safeText(body?.slug, 60).toLowerCase(), name = safeText(body?.name, 180);
  if (!validSlug(slug) || !name) return fail(422, "invalid_seller", "A valid seller slug and name are required.");
  const db = await requireDb(env), id = makeId("sel");
  try { await db.prepare("INSERT INTO commerce_sellers (id,tenant_id,slug,name,status) VALUES (?,?,?,?, 'active')").bind(id, auth.principal.tenantId, slug, name).run(); }
  catch { return fail(409, "seller_conflict", "The seller slug already exists or could not be created."); }
  return json({ ok: true, seller: { id, slug, name, status: "active" } }, 201);
}
async function createBuyer(request, env) {
  const auth = await resolveCommerceAdmin(request, env);
  if (!auth.ok) return fail(auth.status, auth.code, "A valid FORTRESS administrator session is required.");
  const body = await readJson(request), organisationName = safeText(body?.organisation_name, 180);
  const sellerSlug = safeText(body?.seller_slug, 60).toLowerCase();
  if (!organisationName || !validSlug(sellerSlug)) return fail(422, "invalid_buyer", "A buyer organisation name and valid seller slug are required.");
  const db = await requireDb(env);
  const seller = await db.prepare("SELECT id FROM commerce_sellers WHERE slug=? AND tenant_id=? AND status='active'").bind(sellerSlug, auth.principal.tenantId).first();
  if (!seller) return fail(404, "seller_not_found", "An active seller in the administrator tenant was not found.");
  const id = makeId("buy"), apiKey = `izc_${randomSecret()}`;
  try {
    await db.prepare("INSERT INTO commerce_buyers (id,seller_id,organisation_name,api_key_hash,status) VALUES (?,?,?,?,'active')")
      .bind(id, seller.id, organisationName, await sha256Hex(apiKey)).run();
  } catch { return fail(500, "buyer_create_failed", "The buyer account could not be created."); }
  return json({ ok: true, buyer: { id, seller_id: seller.id, organisation_name: organisationName, status: "active" }, api_key: apiKey }, 201);
}
async function createProduct(request, env) {
  const auth = await resolveCommerceAdmin(request, env);
  if (!auth.ok) return fail(auth.status, auth.code, "A valid FORTRESS administrator session is required.");
  let product;
  try { product = validateProductInput(await readJson(request)); }
  catch (error) {
    if (error.message === "invalid_json" || error.message === "payload_too_large") throw error;
    return fail(422, "invalid_product", error.message);
  }
  const db = await requireDb(env);
  const seller = await db.prepare("SELECT id,slug,status FROM commerce_sellers WHERE slug=? AND tenant_id=?").bind(product.sellerSlug, auth.principal.tenantId).first();
  if (!seller || seller.status !== "active") return fail(404, "seller_not_found", "An active seller was not found.");
  const id = makeId("prd");
  try {
    await db.prepare("INSERT INTO commerce_products (id,seller_id,sku,name,description,currency,unit_price_minor,status) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id, seller.id, product.sku, product.name, product.description, product.currency, product.unitPriceMinor, product.status).run();
  } catch { return fail(409, "product_conflict", "The SKU already exists for this seller or the product could not be created."); }
  return json({ ok: true, product: { id, seller_slug: seller.slug, sku: product.sku, name: product.name, description: product.description, currency: product.currency, unit_price_minor: product.unitPriceMinor, status: product.status } }, 201);
}
async function getCatalog(sellerSlug, env) {
  if (!validSlug(sellerSlug)) return fail(400, "invalid_seller_slug", "The seller slug is invalid.");
  const db = await requireDb(env);
  const seller = await db.prepare("SELECT id,slug,name FROM commerce_sellers WHERE slug=? AND status='active'").bind(sellerSlug).first();
  if (!seller) return fail(404, "seller_not_found", "An active seller was not found.");
  const result = await db.prepare("SELECT id,sku,name,description,currency,unit_price_minor FROM commerce_products WHERE seller_id=? AND status='published' ORDER BY sku").bind(seller.id).all();
  return json({ ok: true, seller: { slug: seller.slug, name: seller.name }, products: result.results || [] });
}
async function submitOrder(request, env) {
  const apiKey = request.headers.get("x-izakhono-commerce-buyer-key") || "";
  if (!apiKey) return fail(401, "buyer_access_required", "A buyer API key is required.");
  const idempotencyKey = safeText(request.headers.get("idempotency-key") || "", 128);
  if (idempotencyKey.length < 8 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) return fail(400, "idempotency_key_required", "Provide an idempotency key of 8–128 permitted characters.");
  let orderInput;
  try { orderInput = validateOrderInput(await readJson(request)); }
  catch (error) {
    if (error.message === "invalid_json" || error.message === "payload_too_large") throw error;
    return fail(422, "invalid_order", error.message);
  }
  const db = await requireDb(env), buyerKeyHash = await sha256Hex(apiKey);
  const buyer = await db.prepare("SELECT id,seller_id,organisation_name,status FROM commerce_buyers WHERE api_key_hash=?").bind(buyerKeyHash).first();
  if (!buyer || buyer.status !== "active") return fail(401, "buyer_access_invalid", "The buyer API key is invalid or inactive.");
  const seller = await db.prepare("SELECT id,slug,name,status FROM commerce_sellers WHERE slug=?").bind(orderInput.sellerSlug).first();
  if (!seller || seller.status !== "active") return fail(404, "seller_not_found", "An active seller was not found.");
  if (buyer.seller_id !== seller.id) return fail(403, "buyer_seller_scope_denied", "This buyer credential is not authorised for the requested seller.");
  const placeholders = orderInput.items.map(() => "?").join(",");
  const productRows = await db.prepare(`SELECT id,sku,name,currency,unit_price_minor FROM commerce_products WHERE seller_id=? AND status='published' AND sku IN (${placeholders})`)
    .bind(seller.id, ...orderInput.items.map(x => x.sku)).all();
  const products = new Map((productRows.results || []).map(x => [x.sku, x]));
  if (products.size !== orderInput.items.length) return fail(422, "product_unavailable", "One or more SKUs are not published by this seller.");
  const lines = [];
  let currency = "", subtotalMinor = 0;
  for (const item of orderInput.items) {
    const product = products.get(item.sku);
    if (!currency) currency = product.currency;
    if (currency !== product.currency) return fail(422, "mixed_currency", "An order must contain products in one currency.");
    const lineTotalMinor = product.unit_price_minor * item.quantity;
    if (!Number.isSafeInteger(lineTotalMinor) || lineTotalMinor <= 0) return fail(422, "order_total_overflow", "The order total is outside the supported range.");
    subtotalMinor += lineTotalMinor;
    if (!Number.isSafeInteger(subtotalMinor)) return fail(422, "order_total_overflow", "The order total is outside the supported range.");
    lines.push({ productId: product.id, sku: product.sku, name: product.name, quantity: item.quantity, unitPriceMinor: product.unit_price_minor, lineTotalMinor });
  }
  const requestHash = await sha256Hex(JSON.stringify({ sellerId: seller.id, buyerId: buyer.id, buyerReference: orderInput.buyerReference, currency, lines }));
  const orderId = makeId("ord"), eventId = makeId("evt");
  const statements = [
    db.prepare("INSERT OR IGNORE INTO commerce_orders (id,seller_id,buyer_id,buyer_reference,idempotency_key,request_hash,currency,subtotal_minor,status,payment_status,inventory_status) VALUES (?,?,?,?,?,?,?,?,'submitted','pending','awaiting_seller_confirmation')")
      .bind(orderId, seller.id, buyer.id, orderInput.buyerReference, idempotencyKey, requestHash, currency, subtotalMinor),
    ...lines.map(line => db.prepare("INSERT OR IGNORE INTO commerce_order_lines (id,order_id,product_id,sku_snapshot,name_snapshot,quantity,unit_price_minor,line_total_minor) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM commerce_orders WHERE id=? AND request_hash=?)")
      .bind(makeId("line"), orderId, line.productId, line.sku, line.name, line.quantity, line.unitPriceMinor, line.lineTotalMinor, orderId, requestHash)),
    db.prepare("INSERT OR IGNORE INTO commerce_order_events (id,order_id,event_type,source_key,payload_json) SELECT ?,?,'order.submitted',?,? WHERE EXISTS (SELECT 1 FROM commerce_orders WHERE id=? AND request_hash=?)")
      .bind(eventId, orderId, idempotencyKey, JSON.stringify({ seller_slug: seller.slug, buyer_id: buyer.id, currency, subtotal_minor: subtotalMinor }), orderId, requestHash)
  ];
  await db.batch(statements);
  const order = await db.prepare("SELECT id,seller_id,buyer_id,buyer_reference,currency,subtotal_minor,status,payment_status,inventory_status,created_at,request_hash FROM commerce_orders WHERE buyer_id=? AND idempotency_key=?").bind(buyer.id, idempotencyKey).first();
  if (!order) return fail(500, "order_persist_failed", "The order could not be persisted.");
  if (order.request_hash !== requestHash) return fail(409, "idempotency_conflict", "This idempotency key was already used for a different order payload.");
  const savedLines = await db.prepare("SELECT sku_snapshot AS sku,name_snapshot AS name,quantity,unit_price_minor,line_total_minor FROM commerce_order_lines WHERE order_id=? ORDER BY sku_snapshot").bind(order.id).all();
  const { request_hash: _requestHash, ...publicOrder } = order;
  return json({ ok: true, replayed: order.id !== orderId, order: { ...publicOrder, lines: savedLines.results || [] } }, order.id === orderId ? 201 : 200);
}
async function getBuyerOrder(request, orderId, env) {
  const apiKey = request.headers.get("x-izakhono-commerce-buyer-key") || "";
  if (!apiKey) return fail(401, "buyer_access_required", "A buyer API key is required.");
  const db = await requireDb(env);
  const buyer = await db.prepare("SELECT id,status FROM commerce_buyers WHERE api_key_hash=?").bind(await sha256Hex(apiKey)).first();
  if (!buyer || buyer.status !== "active") return fail(401, "buyer_access_invalid", "The buyer API key is invalid or inactive.");
  const order = await db.prepare("SELECT id,buyer_reference,currency,subtotal_minor,status,payment_status,inventory_status,created_at FROM commerce_orders WHERE id=? AND buyer_id=?").bind(orderId, buyer.id).first();
  if (!order) return fail(404, "order_not_found", "The order was not found.");
  const lines = await db.prepare("SELECT sku_snapshot AS sku,name_snapshot AS name,quantity,unit_price_minor,line_total_minor FROM commerce_order_lines WHERE order_id=? ORDER BY sku_snapshot").bind(order.id).all();
  return json({ ok: true, order: { ...order, lines: lines.results || [] } });
}
export async function fetch(request, env) {
  const url = new URL(request.url), path = url.pathname.replace(/\/+$/, "") || "/";
  try {
    if (request.method === "GET" && path === "/health") return json({ ok: true, service: "izakhono-commerce", version: "0.1.0", mode: "single-seller-core" });
    if (request.method === "POST" && path === "/api/v1/admin/sellers") return await createSeller(request, env);
    if (request.method === "POST" && path === "/api/v1/admin/buyers") return await createBuyer(request, env);
    if (request.method === "POST" && path === "/api/v1/admin/products") return await createProduct(request, env);
    const catalogMatch = path.match(/^\/api\/v1\/catalog\/([a-z0-9-]+)$/);
    if (request.method === "GET" && catalogMatch) return await getCatalog(catalogMatch[1], env);
    if (request.method === "POST" && path === "/api/v1/orders") return await submitOrder(request, env);
    const orderMatch = path.match(/^\/api\/v1\/orders\/([A-Za-z0-9_-]+)$/);
    if (request.method === "GET" && orderMatch) return await getBuyerOrder(request, orderMatch[1], env);
    return fail(404, "route_not_found", "The requested Commerce route was not found.");
  } catch (error) {
    if (error?.message === "invalid_json") return fail(400, "invalid_json", "The request body must be valid JSON.");
    if (error?.message === "payload_too_large") return fail(413, "payload_too_large", "The request body exceeds the allowed size.");
    if (error?.message === "database_unavailable") return fail(503, "database_unavailable", "The Commerce database binding is unavailable.");
    return fail(500, "commerce_internal_error", "The Commerce request could not be completed.");
  }
}
export default { fetch };
