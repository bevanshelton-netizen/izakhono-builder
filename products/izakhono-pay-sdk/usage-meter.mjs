import crypto from "node:crypto";

const ALLOWED_EVENTS = new Set([
  "payment_intent.created",
  "payment_intent.succeeded",
  "payment_intent.failed",
  "refund.created",
  "refund.succeeded",
  "refund.failed",
  "webhook.delivered",
  "api.request"
]);

export function createUsageMeter({ clock = () => new Date() } = {}) {
  const events = [];

  return {
    record(event) {
      if (!event || !ALLOWED_EVENTS.has(event.type)) throw new TypeError("Unsupported usage event type");
      const row = {
        id: event.id || crypto.randomUUID(),
        type: event.type,
        merchant_id: String(event.merchant_id || ""),
        provider: event.provider ? String(event.provider) : null,
        units: Number.isFinite(event.units) && event.units > 0 ? event.units : 1,
        occurred_at: event.occurred_at || clock().toISOString()
      };
      if (!row.merchant_id) throw new TypeError("merchant_id is required");
      events.push(Object.freeze(row));
      return row;
    },
    snapshot(merchantId) {
      const rows = events.filter(e => e.merchant_id === merchantId);
      return rows.reduce((out, e) => {
        out.total_events += 1;
        out.total_units += e.units;
        out.by_type[e.type] = (out.by_type[e.type] || 0) + e.units;
        return out;
      }, { merchant_id: merchantId, total_events: 0, total_units: 0, by_type: {} });
    }
  };
}

export const LICENSE_BASIS = Object.freeze({
  api_request: "per_request",
  payment_intent: "per_transaction",
  enterprise: "annual_license",
  oem: "per_device_or_transaction",
  white_label: "annual_license_plus_usage"
});
