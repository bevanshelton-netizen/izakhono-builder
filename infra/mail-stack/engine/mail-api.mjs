/**
 * IZAKHONO MAIL API — provider-neutral application gateway.
 *
 * Contract:
 *   POST /api/mail/send
 *   GET  /api/mail/health
 *
 * The gateway owns authorization, validation, idempotency and request
 * correlation. Durable persistence is injected through MailStore; delivery
 * remains behind MailRuntime/TransportEngine.
 */

import { createHash, randomUUID } from "node:crypto";

const MAX_IDEMPOTENCY_KEY = 255;
const MAX_RECIPIENTS = 100;

export class MailApi {
  constructor({
    runtime,
    authorize = defaultAuthorize,
    idempotency = new MemoryIdempotencyStore(),
    store = null,
    renderer = null,
    clock = () => new Date().toISOString(),
    idFactory = () => randomUUID(),
  } = {}) {
    if (!runtime) throw new Error("runtime is required");
    this.runtime = runtime;
    this.authorize = authorize;
    this.store = store;
    this.idempotency = store || idempotency;
    this.renderer = renderer;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  async handle(request) {
    const method = String(request?.method || "GET").toUpperCase();
    const url = new URL(request?.url || "http://izakhono.local/api/mail/health");

    if (method === "GET" && url.pathname === "/api/mail/health") {
      return json(200, { ok: true, service: "izakhono-mail", health: this.runtime.health() });
    }

    if (method !== "POST" || url.pathname !== "/api/mail/send") {
      return json(404, { error: "not_found" });
    }

    const auth = await this.authorize(request);
    if (!auth?.allowed) return json(401, { error: "unauthorized" });

    const key = getHeader(request.headers, "idempotency-key");
    if (!key || key.length > MAX_IDEMPOTENCY_KEY || !/^[\x20-\x7E]+$/.test(key)) {
      return json(400, { error: "invalid_idempotency_key" });
    }

    let body;
    try {
      body = await readJson(request);
    } catch {
      return json(400, { error: "invalid_json" });
    }

    const scope = `${auth.tenantId || "default"}:${auth.appId || "unknown"}`;
    const fingerprint = fingerprintRequest(body);
    const existing = await this.idempotency.get(scope, key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) return json(409, { error: "idempotency_mismatch" });
      return json(existing.statusCode || 202, { ...existing.response, idempotent_replay: true });
    }

    const permission = body?.kind === "marketing" ? "mail:marketing" : "mail:transactional";
    if (!hasScope(auth.scopes, permission)) return json(403, { error: "forbidden", required_scope: permission });

    const validation = validateEnvelope(body);
    if (!validation.ok) return json(422, { error: "invalid_request", details: validation.errors });

    let envelope = { ...body };
    if (body.template) {
      if (!this.renderer) return json(503, { error: "renderer_unavailable" });
      try {
        envelope = { ...envelope, ...(await this.renderer.render(body.template, body.data || {}, { auth })) };
      } catch (error) {
        return json(422, { error: "render_failed", message: String(error?.message || error) });
      }
    }

    const messageId = this.idFactory();
    const eventId = this.idFactory();
    const acceptedAt = this.clock();
    const response = { message_id: messageId, event_id: eventId, status: "queued", accepted_at: acceptedAt };

    try {
      if (this.store) {
        await this.store.putMessage({
          message_id: messageId,
          tenant_id: auth.tenantId || "default",
          app_id: auth.appId || "unknown",
          status: "queued",
          envelope,
          metadata: {
            kind: body.kind || "transactional",
            idempotency_scope: scope,
            idempotency_key: key,
          },
          created_at: acceptedAt,
          updated_at: acceptedAt,
        });

        await this.store.appendEvent({
          id: eventId,
          message_id: messageId,
          tenant_id: auth.tenantId || "default",
          type: "mail.queued",
          data: { app_id: auth.appId || "unknown" },
          occurred_at: acceptedAt,
        });
      }

      await this.idempotency.put(scope, key, {
        fingerprint,
        statusCode: 202,
        response,
        tenant_id: auth.tenantId || "default",
        created_at: acceptedAt,
      });

      this.runtime.queue.enqueue({
        id: messageId,
        eventId,
        tenantId: auth.tenantId,
        appId: auth.appId,
        kind: body.kind || "transactional",
        envelope,
        acceptedAt,
      });
    } catch (error) {
      await this.idempotency.delete(scope, key).catch(() => {});
      if (this.store) {
        try {
          await this.store.putMessage({
            message_id: messageId,
            tenant_id: auth.tenantId || "default",
            app_id: auth.appId || "unknown",
            status: "failed",
            envelope,
            metadata: { error: String(error?.message || error) },
            created_at: acceptedAt,
            updated_at: this.clock(),
          });
          await this.store.appendEvent({
            id: this.idFactory(),
            message_id: messageId,
            tenant_id: auth.tenantId || "default",
            type: "mail.failed",
            data: { stage: "accept", error: String(error?.message || error) },
            occurred_at: this.clock(),
          });
        } catch {
          // Persistence failure must not mask the original acceptance error.
        }
      }
      return json(503, { error: "queue_unavailable", message: String(error?.message || error) });
    }

    return json(202, response);
  }
}

export class MemoryIdempotencyStore {
  constructor() { this.store = new Map(); }
  async get(scope, key) { return this.store.get(`${scope}:${key}`) || null; }
  async put(scope, key, value) { this.store.set(`${scope}:${key}`, value); }
  async delete(scope, key) { this.store.delete(`${scope}:${key}`); }
}

function validateEnvelope(body) {
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) errors.push("body must be an object");
  if (!body?.from) errors.push("from is required");
  if (!body?.to) errors.push("to is required");
  if (!body?.subject) errors.push("subject is required");
  if (!body?.template && !body?.html && !body?.text) errors.push("template, html or text is required");
  const recipients = normalizeRecipients(body?.to);
  if (!recipients.length) errors.push("to must contain at least one recipient");
  if (recipients.length > MAX_RECIPIENTS) errors.push(`to may contain at most ${MAX_RECIPIENTS} recipients`);
  return { ok: errors.length === 0, errors };
}

function normalizeRecipients(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function fingerprintRequest(body) {
  return createHash("sha256").update(stableStringify(body)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const pairs = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${pairs.join(",")}}`;
  }
  return JSON.stringify(value);
}

function getHeader(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const found = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return found ? String(headers[found]) : "";
}

async function readJson(request) {
  if (request?.body && typeof request.body === "object") return request.body;
  if (typeof request?.json === "function") return request.json();
  if (typeof request?.body === "string") return JSON.parse(request.body);
  return {};
}

function hasScope(scopes, required) {
  return Array.isArray(scopes) && (scopes.includes(required) || scopes.includes("mail:*") || scopes.includes("*"));
}

async function defaultAuthorize() { return { allowed: false }; }

function json(status, body) {
  return { status, headers: { "content-type": "application/json" }, body };
}
