/**
 * IZAKHONO MAIL TIMELINE API — read-only delivery observability boundary.
 *
 * Tenant authorization is enforced before message or event data is exposed.
 * Message bodies, credentials and rendered content are intentionally omitted.
 */

export class MailTimelineApi {
  constructor({ store, authorize = defaultAuthorize } = {}) {
    if (!store) throw new Error("store is required");
    this.store = store;
    this.authorize = authorize;
  }

  async handle(request) {
    const method = String(request?.method || "GET").toUpperCase();
    if (method !== "GET") return json(405, { error: "method_not_allowed" });

    const url = new URL(request?.url || "http://izakhono.local/");
    const match = url.pathname.match(/^\/api\/mail\/messages\/([^/]+)(?:\/events)?$/);
    if (!match) return json(404, { error: "not_found" });

    const auth = await this.authorize(request);
    if (!auth?.allowed) return json(401, { error: "unauthorized" });

    const messageId = decodeURIComponent(match[1]);
    const eventsPath = url.pathname.endsWith("/events");
    const message = await this.store.getMessage(messageId, { tenantId: auth.tenantId });
    if (!message) return json(404, { error: "message_not_found" });

    if (eventsPath) {
      const events = await this.store.listEvents(messageId, { tenantId: auth.tenantId });
      return json(200, { message_id: messageId, events: events || [] });
    }

    return json(200, { message: publicMessage(message) });
  }
}

function publicMessage(message) {
  return {
    message_id: message.message_id,
    tenant_id: message.tenant_id,
    app_id: message.app_id,
    kind: message.kind,
    status: message.status,
    accepted_at: message.accepted_at || null,
    updated_at: message.updated_at || null,
    last_event_id: message.last_event_id || null,
  };
}

async function defaultAuthorize() { return { allowed: false }; }

function json(status, body) {
  return { status, headers: { "content-type": "application/json" }, body };
}
