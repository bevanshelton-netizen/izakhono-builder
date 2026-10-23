import crypto from "node:crypto";

const MAX_RECIPIENTS = 100;
const MAX_SUBJECT = 998;
const DELIVERY_STATES = ["queued", "rendering", "sending", "accepted", "delivered", "render_failed", "provider_failed", "bounced", "rejected", "suppressed"];

function email(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error("INVALID_EMAIL");
  return v;
}

function recipient(value) {
  if (typeof value === "string") return { email: email(value) };
  if (!value || typeof value !== "object") throw new Error("INVALID_RECIPIENT");
  return { email: email(value.email), ...(value.name ? { name: String(value.name).trim() } : {}) };
}

function stableEventId(request) {
  const material = JSON.stringify({
    app: request.app,
    template: request.template,
    to: request.to.map((r) => r.email).sort(),
    data: request.data || {},
    idempotencyKey: request.idempotencyKey || null,
  });
  return `izm-${crypto.createHash("sha256").update(material).digest("hex").slice(0, 32)}`;
}

export function validateSendRequest(input) {
  if (!input || typeof input !== "object") throw new Error("INVALID_REQUEST");
  const app = String(input.app || "").trim();
  const template = String(input.template || "").trim();
  if (!app) throw new Error("APP_REQUIRED");
  if (!template) throw new Error("TEMPLATE_REQUIRED");

  const to = Array.isArray(input.to) ? input.to.map(recipient) : [];
  if (!to.length) throw new Error("NO_RECIPIENTS");
  if (to.length > MAX_RECIPIENTS) throw new Error("TOO_MANY_RECIPIENTS");

  const subject = input.subject == null ? undefined : String(input.subject).trim();
  if (subject && subject.length > MAX_SUBJECT) throw new Error("SUBJECT_TOO_LONG");

  const channel = input.channel || "email";
  if (channel !== "email") throw new Error("UNSUPPORTED_CHANNEL");

  const request = {
    version: 1,
    channel,
    app,
    template,
    to,
    data: input.data && typeof input.data === "object" ? input.data : {},
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    ...(subject ? { subject } : {}),
    ...(input.from ? { from: String(input.from).trim() } : {}),
    ...(input.replyTo ? { replyTo: email(input.replyTo) } : {}),
    ...(input.idempotencyKey ? { idempotencyKey: String(input.idempotencyKey).trim() } : {}),
  };
  return { ...request, eventId: stableEventId(request) };
}

export function createMailJob(input) {
  const request = validateSendRequest(input);
  return {
    id: request.eventId,
    type: "email.send",
    state: "queued",
    createdAt: new Date().toISOString(),
    request,
    audit: {
      service: "izakhono-mail",
      version: 1,
      app: request.app,
      template: request.template,
    },
  };
}

export function transition(job, nextState, details = {}) {
  if (!DELIVERY_STATES.includes(nextState)) throw new Error("INVALID_DELIVERY_STATE");
  return { ...job, state: nextState, updatedAt: new Date().toISOString(), details };
}

export const DELIVERY_STATES_LIST = DELIVERY_STATES;
