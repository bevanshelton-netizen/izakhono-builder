import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8080);
const DATA_FILE = process.env.CRM_DATA_FILE || path.join(__dirname, "crm-data.json");
const ADMIN_TOKEN = process.env.CRM_ADMIN_TOKEN || "";
const INGEST_TOKEN = process.env.CRM_INGEST_TOKEN || "";

const EMPTY = { contacts: [], deals: [], activities: [] };
let writeChain = Promise.resolve();

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data),
    "cache-control": "no-store"
  });
  res.end(data);
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  res.end(body);
}

function bearer(req) {
  const raw = req.headers.authorization || "";
  return raw.startsWith("Bearer ") ? raw.slice(7) : "";
}

function safeEqual(a, b) {
  if (!a || !b) return false;
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function requireAdmin(req, res) {
  if (!ADMIN_TOKEN) return true;
  if (safeEqual(bearer(req), ADMIN_TOKEN)) return true;
  json(res, 401, { error: "unauthorized" });
  return false;
}

function requireIngest(req, res) {
  if (!INGEST_TOKEN && !ADMIN_TOKEN) return true;
  const token = bearer(req);
  if ((INGEST_TOKEN && safeEqual(token, INGEST_TOKEN)) || (ADMIN_TOKEN && safeEqual(token, ADMIN_TOKEN))) return true;
  json(res, 401, { error: "unauthorized" });
  return false;
}

function scopeFrom(req, url) {
  const entity = String(req.headers["x-entity-id"] || url.searchParams.get("entity") || "").trim();
  const platform = String(req.headers["x-platform-id"] || url.searchParams.get("platform") || "").trim();
  if (!entity || !platform) return null;
  return { entity_id: entity, platform_id: platform };
}

async function readStore() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      deals: Array.isArray(parsed.deals) ? parsed.deals : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : []
    };
  } catch (error) {
    if (error.code === "ENOENT") return structuredClone(EMPTY);
    throw error;
  }
}

async function writeStore(store) {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const temp = `${DATA_FILE}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(store, null, 2), { mode: 0o600 });
    await fs.rename(temp, DATA_FILE);
  });
  return writeChain;
}

async function readBody(req, limit = 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("body too large"), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("invalid json"), { status: 400 });
  }
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function scoped(rows, scope) {
  return rows.filter((row) => row.entity_id === scope.entity_id && row.platform_id === scope.platform_id);
}

function cleanString(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => cleanString(v, 64)).filter(Boolean).slice(0, 20);
}

function contactPayload(body, scope) {
  return {
    ...scope,
    name: cleanString(body.name, 200),
    email: cleanString(body.email, 320).toLowerCase(),
    phone: cleanString(body.phone, 80),
    company: cleanString(body.company, 200),
    role: cleanString(body.role, 120),
    source: cleanString(body.source, 120),
    status: cleanString(body.status || "lead", 80),
    tags: cleanTags(body.tags)
  };
}

function dealPayload(body, scope) {
  const value = Number(body.value || 0);
  return {
    ...scope,
    contact_id: cleanString(body.contact_id, 120),
    title: cleanString(body.title || "New opportunity", 240),
    value: Number.isFinite(value) ? value : 0,
    currency: cleanString(body.currency || "ZAR", 8).toUpperCase(),
    stage: cleanString(body.stage || "New", 120),
    owner: cleanString(body.owner, 160),
    source: cleanString(body.source, 120),
    external_ref: cleanString(body.external_ref, 200),
    next_action: cleanString(body.next_action, 500),
    next_action_due: cleanString(body.next_action_due, 40)
  };
}

function summary(store, scope) {
  const contacts = scoped(store.contacts, scope);
  const deals = scoped(store.deals, scope);
  const activities = scoped(store.activities, scope);
  const won = deals.filter((d) => /(^|\b)won(\b|$)/i.test(d.stage));
  const open = deals.filter((d) => !/(^|\b)(won|lost)(\b|$)/i.test(d.stage));
  const pipelineValue = open.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const wonValue = won.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const byStage = {};
  for (const deal of deals) byStage[deal.stage] = (byStage[deal.stage] || 0) + 1;
  return {
    scope,
    contacts: contacts.length,
    open_deals: open.length,
    pipeline_value: pipelineValue,
    won_value: wonValue,
    activities: activities.length,
    by_stage: byStage
  };
}

function insights(store, scope) {
  const deals = scoped(store.deals, scope);
  const today = Date.now();
  const open = deals.filter((d) => !/(^|\b)(won|lost)(\b|$)/i.test(d.stage));
  const overdue = open.filter((d) => d.next_action_due && Date.parse(d.next_action_due) < today);
  const stale = open.filter((d) => today - Date.parse(d.updated_at || d.created_at) > 7 * 86400000);
  const highValue = [...open].sort((a, b) => Number(b.value || 0) - Number(a.value || 0)).slice(0, 5);
  const recommendations = [];
  if (overdue.length) recommendations.push(`${overdue.length} open deal(s) have an overdue next action.`);
  if (stale.length) recommendations.push(`${stale.length} open deal(s) have had no update for more than 7 days.`);
  if (highValue[0]?.value > 0) recommendations.push(`Highest-value open opportunity: ${highValue[0].title} (${highValue[0].currency} ${Number(highValue[0].value).toLocaleString("en-ZA")}).`);
  if (!recommendations.length) recommendations.push("No urgent deterministic follow-up flags are currently detected.");
  return { overdue, stale, high_value: highValue, recommendations, mode: "deterministic-v1" };
}

async function serveStatic(url, res) {
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const body = await fs.readFile(path.join(__dirname, "public", "index.html"), "utf8");
    return text(res, 200, body, "text/html; charset=utf-8");
  }
  if (url.pathname === "/app.js") {
    const body = await fs.readFile(path.join(__dirname, "public", "app.js"), "utf8");
    return text(res, 200, body, "text/javascript; charset=utf-8");
  }
  if (url.pathname === "/registry.json") {
    const body = await fs.readFile(path.join(__dirname, "portfolio-crm-registry.json"), "utf8");
    return text(res, 200, body, "application/json; charset=utf-8");
  }
  return false;
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "izakhono-crm", version: "0.1.0" });
    }

    if (!url.pathname.startsWith("/api/")) {
      const served = await serveStatic(url, res);
      if (served !== false) return served;
      return json(res, 404, { error: "not found" });
    }

    const scope = scopeFrom(req, url);
    if (!scope) return json(res, 400, { error: "X-Entity-ID and X-Platform-ID are required" });

    if (url.pathname === "/api/intake") {
      if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
      if (!requireIngest(req, res)) return;
      const body = await readBody(req);
      const store = await readStore();
      const payload = contactPayload(body.contact || body, scope);
      const dp = (body.deal || body.create_deal) ? dealPayload(body.deal || body, scope) : null;
      let deal = dp?.external_ref ? scoped(store.deals, scope).find((row) => row.external_ref === dp.external_ref) || null : null;
      const hasContactInput = Boolean(payload.name || payload.email || payload.phone || payload.company);
      let contact = hasContactInput ? scoped(store.contacts, scope).find((row) =>
        (payload.email && row.email === payload.email) || (payload.phone && row.phone === payload.phone)
      ) : null;
      if (!contact && deal?.contact_id) {
        contact = scoped(store.contacts, scope).find((row) => row.id === deal.contact_id) || null;
      }
      if (!contact && !hasContactInput) {
        return json(res, 400, { error: "new lead intake needs contact data; deal-only updates require an existing external_ref" });
      }
      if (!contact) {
        contact = { id: id("contact"), ...payload, created_at: now(), updated_at: now() };
        store.contacts.push(contact);
      } else if (hasContactInput) {
        Object.assign(contact, payload, { updated_at: now() });
      }
      if (dp) {
        if (deal) {
          Object.assign(deal, dp, { contact_id: contact.id, updated_at: now() });
        } else {
          deal = { id: id("deal"), ...dp, contact_id: contact.id, created_at: now(), updated_at: now() };
          store.deals.push(deal);
        }
      }
      if (url.searchParams.get("dry_run") === "true") {
        return json(res, 200, {
          ok: true,
          dry_run: true,
          scope,
          contact_valid: true,
          deal_valid: Boolean(dp),
          external_ref: dp?.external_ref || ""
        });
      }
      store.activities.push({
        id: id("activity"), ...scope, contact_id: contact.id, deal_id: deal?.id || "",
        type: "lead_intake", note: cleanString(body.note || "Lead captured", 1000),
        created_at: now(), updated_at: now()
      });
      await writeStore(store);
      return json(res, 201, { contact, deal });
    }

    if (!requireAdmin(req, res)) return;
    const store = await readStore();

    if (req.method === "GET" && url.pathname === "/api/summary") {
      return json(res, 200, summary(store, scope));
    }

    if (req.method === "GET" && url.pathname === "/api/insights") {
      return json(res, 200, insights(store, scope));
    }

    if (url.pathname === "/api/contacts") {
      if (req.method === "GET") return json(res, 200, { items: scoped(store.contacts, scope) });
      if (req.method === "POST") {
        const body = await readBody(req);
        const payload = contactPayload(body, scope);
        if (!payload.name && !payload.email && !payload.phone && !payload.company) {
          return json(res, 400, { error: "contact must include a name, email, phone or company" });
        }
        const row = { id: id("contact"), ...payload, created_at: now(), updated_at: now() };
        store.contacts.push(row);
        await writeStore(store);
        return json(res, 201, row);
      }
      return json(res, 405, { error: "method not allowed" });
    }

    if (url.pathname === "/api/deals") {
      if (req.method === "GET") return json(res, 200, { items: scoped(store.deals, scope) });
      if (req.method === "POST") {
        const body = await readBody(req);
        const row = { id: id("deal"), ...dealPayload(body, scope), created_at: now(), updated_at: now() };
        store.deals.push(row);
        store.activities.push({
          id: id("activity"), ...scope, contact_id: row.contact_id, deal_id: row.id,
          type: "deal_created", note: `Deal created in stage ${row.stage}`, created_at: now(), updated_at: now()
        });
        await writeStore(store);
        return json(res, 201, row);
      }
      return json(res, 405, { error: "method not allowed" });
    }

    if (url.pathname.startsWith("/api/deals/") && req.method === "PATCH") {
      const dealId = decodeURIComponent(url.pathname.slice("/api/deals/".length));
      const row = store.deals.find((d) => d.id === dealId && d.entity_id === scope.entity_id && d.platform_id === scope.platform_id);
      if (!row) return json(res, 404, { error: "deal not found" });
      const body = await readBody(req);
      const allowed = ["title","value","currency","stage","owner","source","external_ref","next_action","next_action_due","contact_id"];
      const previousStage = row.stage;
      for (const key of allowed) if (key in body) row[key] = key === "value" ? Number(body[key] || 0) : cleanString(body[key], key === "next_action" ? 500 : 240);
      row.updated_at = now();
      if (body.stage && body.stage !== previousStage) {
        store.activities.push({
          id: id("activity"), ...scope, contact_id: row.contact_id, deal_id: row.id,
          type: "stage_changed", note: `${previousStage} → ${row.stage}`, created_at: now(), updated_at: now()
        });
      }
      await writeStore(store);
      return json(res, 200, row);
    }

    if (url.pathname === "/api/activities") {
      if (req.method === "GET") return json(res, 200, { items: scoped(store.activities, scope) });
      if (req.method === "POST") {
        const body = await readBody(req);
        const row = {
          id: id("activity"), ...scope,
          contact_id: cleanString(body.contact_id, 120),
          deal_id: cleanString(body.deal_id, 120),
          type: cleanString(body.type || "note", 80),
          note: cleanString(body.note, 2000),
          due_at: cleanString(body.due_at, 40),
          completed: Boolean(body.completed),
          created_at: now(), updated_at: now()
        };
        store.activities.push(row);
        await writeStore(store);
        return json(res, 201, row);
      }
      return json(res, 405, { error: "method not allowed" });
    }

    if (req.method === "GET" && url.pathname === "/api/export") {
      return json(res, 200, {
        exported_at: now(),
        scope,
        contacts: scoped(store.contacts, scope),
        deals: scoped(store.deals, scope),
        activities: scoped(store.activities, scope)
      });
    }

    return json(res, 404, { error: "not found" });
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.status ? error.message : "internal server error" });
  }
}

const server = http.createServer(handler);
server.listen(PORT, HOST, () => {
  console.log(`IZAKHONO CRM listening on http://${HOST}:${PORT}`);
});
