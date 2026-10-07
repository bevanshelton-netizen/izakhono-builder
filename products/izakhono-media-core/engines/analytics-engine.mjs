const ALLOWED_EVENTS = new Set(["stream_started", "stream_stopped", "play_started", "play_completed", "ad_impression", "ad_click", "subscription_started", "subscription_cancelled", "lead_created", "customer_created", "revenue_recorded"]);

export function normalizeEvent(event = {}) {
  const type = String(event.type || "");
  if (!ALLOWED_EVENTS.has(type)) throw new Error(`unsupported analytics event: ${type}`);
  return {
    id: String(event.id || `${type}-${Date.now()}`),
    type,
    channel_id: event.channel_id ? String(event.channel_id) : null,
    session_id: event.session_id ? String(event.session_id) : null,
    value: Number.isFinite(Number(event.value)) ? Number(event.value) : 0,
    currency: event.currency ? String(event.currency).toUpperCase() : null,
    occurred_at: event.occurred_at ? new Date(event.occurred_at).toISOString() : new Date().toISOString(),
    metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : {}
  };
}

export function summarizeEvents(events = []) {
  const summary = { events: 0, by_type: {}, revenue: 0, currency: null, channels: {} };
  for (const raw of events) {
    const event = normalizeEvent(raw);
    summary.events += 1;
    summary.by_type[event.type] = (summary.by_type[event.type] || 0) + 1;
    if (event.type === "revenue_recorded") summary.revenue += event.value;
    if (!summary.currency && event.currency) summary.currency = event.currency;
    if (event.channel_id) summary.channels[event.channel_id] = (summary.channels[event.channel_id] || 0) + 1;
  }
  return summary;
}
