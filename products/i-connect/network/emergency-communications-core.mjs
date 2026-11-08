/**
 * I-CONNECT emergency communications routing primitives.
 * Plans fallback from verified device/provider signals; never initiates calls or claims delivery.
 */
export const ROUTE_ORDER = Object.freeze(["internet_ptt", "cellular_voice", "sms", "nearby_relay", "satellite"]);
const TERMINAL = new Set(["acknowledged", "expired"]);
const TRANSITIONS = Object.freeze({
  draft: new Set(["queued", "attempting", "failed"]),
  queued: new Set(["attempting", "expired", "failed"]),
  attempting: new Set(["queued", "sent", "delivered", "failed", "expired"]),
  sent: new Set(["delivered", "acknowledged", "queued", "failed", "expired"]),
  delivered: new Set(["acknowledged", "queued", "expired"]),
  acknowledged: new Set(), failed: new Set(["queued"]), expired: new Set(),
});
export function selectEmergencyRoutes(signals = {}) {
  return ROUTE_ORDER.flatMap((route, priority) => {
    const s = signals[route];
    if (!s || s.supported !== true || s.available !== true) return [];
    if (s.consentRequired === true && s.consentGranted !== true) return [];
    return [{ route, priority, requiresUserAction: s.requiresUserAction === true, evidenceAt: typeof s.evidenceAt === "string" ? s.evidenceAt : null }];
  });
}
export function planEmergencyFallback(signals = {}) {
  const routes = selectEmergencyRoutes(signals);
  return { routes, primary: routes[0] ?? null, alternatives: routes.slice(1), noRouteAvailable: routes.length === 0, userWarning: routes.length ? null : "No communication route is currently verified. Preserve the alert and retry when connectivity returns; seek nearby human assistance." };
}
export function transitionDelivery(current, next, evidence = {}) {
  if (!Object.hasOwn(TRANSITIONS, current) || !Object.hasOwn(TRANSITIONS, next)) throw new Error("Unknown delivery state");
  if (TERMINAL.has(current) || !TRANSITIONS[current].has(next)) throw new Error("Invalid delivery transition: " + current + " -> " + next);
  if (["sent", "delivered", "acknowledged"].includes(next) && (typeof evidence.receiptId !== "string" || !evidence.receiptId.trim())) throw new Error("A trusted receiptId is required for " + next);
  if (next === "acknowledged" && evidence.humanAcknowledgement !== true) throw new Error("Human acknowledgement evidence is required");
  return { state: next, receiptId: evidence.receiptId ?? null, updatedAt: typeof evidence.updatedAt === "string" ? evidence.updatedAt : null };
}
export function createEmergencyEnvelope(input) {
  if (!input || typeof input.eventId !== "string" || !input.eventId.trim()) throw new Error("eventId is required");
  if (typeof input.createdAt !== "string" || !input.createdAt.trim()) throw new Error("createdAt is required");
  if (!Array.isArray(input.requestedChannels) || input.requestedChannels.length === 0) throw new Error("At least one requested channel is required");
  const allowed = new Set(ROUTE_ORDER);
  if (input.requestedChannels.some((channel) => !allowed.has(channel))) throw new Error("Unsupported communication channel");
  const loc = input.location && typeof input.location === "object" ? input.location : null;
  return Object.freeze({ eventId: input.eventId, createdAt: input.createdAt, severity: input.severity === "critical" ? "critical" : "urgent", message: typeof input.message === "string" ? input.message.slice(0, 1000) : "", location: loc ? { latitude: Number.isFinite(loc.latitude) ? loc.latitude : null, longitude: Number.isFinite(loc.longitude) ? loc.longitude : null, accuracyMetres: Number.isFinite(loc.accuracyMetres) ? loc.accuracyMetres : null, capturedAt: typeof loc.capturedAt === "string" ? loc.capturedAt : null } : null, requestedChannels: [...new Set(input.requestedChannels)], status: "queued" });
}