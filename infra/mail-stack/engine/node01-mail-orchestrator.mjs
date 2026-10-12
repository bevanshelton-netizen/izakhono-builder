/**
 * IZAKHONO MAIL — NODE01 production orchestrator.
 *
 * Owned control-plane facade for boot, readiness, health and graceful shutdown.
 * It deliberately refuses to report production-ready unless every configured
 * gate has been positively verified by an injected probe.
 */

const REQUIRED_GATES = [
  "runtime",
  "smtp",
  "submission",
  "dnsMx",
  "spf",
  "dkim",
  "dmarc",
  "tls",
  "inbound",
  "outbound",
  "reply",
  "persistence",
  "identities",
];

export class Node01MailOrchestrator {
  constructor({ runtime, server, probes = {} } = {}) {
    if (!runtime) throw new Error("MAIL_RUNTIME_REQUIRED");
    this.runtime = runtime;
    this.server = server;
    this.probes = probes;
    this.startedAt = null;
    this.state = "stopped";
    this.lastReadiness = null;
  }

  async boot(options = {}) {
    if (!this.server) throw new Error("MAIL_SERVER_REQUIRED");
    await this.server.start(options);
    this.startedAt = new Date().toISOString();
    this.state = "running";
    return this.readiness();
  }

  async readiness() {
    const checks = {};
    for (const gate of REQUIRED_GATES) {
      const probe = this.probes[gate];
      try {
        checks[gate] = probe ? await probe() : { ok: false, reason: "PROBE_NOT_CONFIGURED" };
      } catch (error) {
        checks[gate] = { ok: false, reason: String(error?.message || error) };
      }
    }
    const failed = REQUIRED_GATES.filter(gate => !checks[gate]?.ok);
    const result = {
      state: this.state,
      productionReady: failed.length === 0,
      live: false,
      failed,
      checks,
      runtime: this.runtime.health(),
      startedAt: this.startedAt,
      verifiedAt: new Date().toISOString(),
    };
    this.lastReadiness = result;
    return result;
  }

  async health() {
    return {
      state: this.state,
      runtime: this.runtime.health(),
      readiness: this.lastReadiness || await this.readiness(),
    };
  }

  async shutdown() {
    if (this.server) await this.server.stop();
    this.state = "stopped";
    return { state: this.state };
  }
}

export { REQUIRED_GATES };
