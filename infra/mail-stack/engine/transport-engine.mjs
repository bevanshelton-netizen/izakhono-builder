/** IZAKHONO MAIL TRANSPORT ENGINE — owned-first adapter boundary. */
export class TransportEngine {
  constructor({ adapters = [] } = {}) { this.adapters = adapters; }
  register(adapter) { if (!adapter?.name || typeof adapter.send !== "function") throw new Error("INVALID_TRANSPORT_ADAPTER"); this.adapters.push(adapter); return adapter.name; }
  async send(envelope, context = {}) {
    const candidates = this.adapters.filter(a => a.enabled !== false && (!a.supports || a.supports(envelope, context))).sort((a,b) => (a.priority ?? 100) - (b.priority ?? 100));
    if (!candidates.length) throw new Error("NO_MAIL_TRANSPORT_AVAILABLE");
    const failures = [];
    for (const adapter of candidates) {
      try { const result = await adapter.send(envelope, context); return { adapter: adapter.name, result }; }
      catch (error) { failures.push({ adapter: adapter.name, error: String(error?.message || error) }); }
    }
    const error = new Error("ALL_MAIL_TRANSPORTS_FAILED"); error.failures = failures; throw error;
  }
  health() { return this.adapters.map(a => ({ name: a.name, enabled: a.enabled !== false, priority: a.priority ?? 100, mode: a.mode || "unknown" })); }
}

export function localTransport(sendFn) { return { name: "izakhono-local", mode: "owned", priority: 1, enabled: true, send: sendFn }; }
export function relayTransport(sendFn) { return { name: "external-relay-bridge", mode: "reversible-fallback", priority: 50, enabled: true, send: sendFn }; }
