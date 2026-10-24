/**
 * IZAKHONO MAIL — NODE01 production orchestrator.
 *
 * Owned control-plane facade for boot, readiness, health and graceful shutdown.
 * It deliberately refuses to report production-ready unless every configured
 * technical gate AND every independent production-acceptance gate has been
 * positively verified by evidence-bearing probes.
 */

import {
  PRODUCTION_ACCEPTANCE_GATES,
  evaluateProductionAcceptance,
} from "./mail-production-acceptance.mjs";

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

function invalidProbeResult(gate) {
  return {
    ok: false,
    reason: "INVALID_PROBE_EVIDENCE",
    gate,
  };
}

function normalizeProbeResult(gate, result) {
  if (!result || result.ok !== true) {
    return result || { ok: false, reason: "PROBE_RETURNED_NO_RESULT", gate };
  }

  // A positive gate is only accepted when the probe identifies where the
  // evidence came from and when it was verified. This prevents callers from
  // manufacturing readiness with `{ ok: true }` alone.
  if (typeof result.source !== "string" || !result.source.trim()) {
    return invalidProbeResult(gate);
  }
  if (typeof result.verifiedAt !== "string" || Number.isNaN(Date.parse(result.verifiedAt))) {
    return invalidProbeResult(gate);
  }
  return { ...result, gate };
}

export class Node01MailOrchestrator {
  constructor({ runtime, server, probes = {}, productionProbes = {} } = {}) {
    if (!runtime) throw new Error("MAIL_RUNTIME_REQUIRED");
    this.runtime = runtime;
    this.server = server;
    this.probes = probes;
    this.productionProbes = productionProbes;
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
        checks[gate] = normalizeProbeResult(
          gate,
          probe ? await probe() : { ok: false, reason: "PROBE_NOT_CONFIGURED", gate }
        );
      } catch (error) {
        checks[gate] = { ok: false, reason: String(error?.message || error), gate };
      }
    }

    // Production acceptance is deliberately separate from technical
    // readiness. These gates require independent evidence of public MX,
    // network reachability, authenticated submission, persistence, outbound
    // acceptance, reply receipt, identity routing and security authentication.
    // Configuration-only assertions cannot satisfy this decision point.
    const productionEvidence = {};
    for (const gate of PRODUCTION_ACCEPTANCE_GATES) {
      const probe = this.productionProbes[gate];
      try {
        productionEvidence[gate] = normalizeProbeResult(
          gate,
          probe ? await probe() : { ok: false, reason: "PRODUCTION_PROBE_NOT_CONFIGURED", gate }
        );
      } catch (error) {
        productionEvidence[gate] = {
          ok: false,
          reason: String(error?.message || error),
          gate,
        };
      }
    }

    const productionAcceptance = evaluateProductionAcceptance(productionEvidence);
    const failedTechnical = REQUIRED_GATES.filter(gate => !checks[gate]?.ok);
    const failed = [
      ...failedTechnical,
      ...productionAcceptance.failed.map(gate => `production:${gate}`),
    ];

    const technicalReady = failedTechnical.length === 0;
    const result = {
      state: this.state,
      technicalReady,
      productionReady: technicalReady && productionAcceptance.productionReady,
      live: technicalReady && productionAcceptance.live,
      failed,
      checks,
      productionAcceptance,
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

export { REQUIRED_GATES, PRODUCTION_ACCEPTANCE_GATES };
