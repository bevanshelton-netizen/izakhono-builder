/**
 * IZAKHONO BRAIN KERNEL
 *
 * Deterministic decision fabric. Domain brains plug in as policies/adapters;
 * the kernel owns arbitration, safety gates, evidence and audit semantics.
 */

const TERMINAL = new Set(["completed", "rejected", "blocked"]);

export class BrainKernel {
  constructor({ registry = [], policies = {}, clock = () => new Date().toISOString() } = {}) {
    this.registry = new Map(registry.map(brain => [brain.id, brain]));
    this.policies = policies;
    this.clock = clock;
    this.audit = [];
  }

  decide({ brain, intent, facts = {}, evidence = [], requestedAction = null, reversible = true, authorization = false } = {}) {
    if (!this.registry.has(brain)) return this.#result("rejected", brain, intent, "UNKNOWN_BRAIN");
    if (!intent) return this.#result("rejected", brain, intent, "INTENT_REQUIRED");

    const policy = this.policies[brain];
    if (!policy) return this.#result("blocked", brain, intent, "POLICY_NOT_CONFIGURED");

    const decision = policy({ intent, facts, evidence });
    if (!decision?.ok) return this.#result("blocked", brain, intent, decision?.reason || "POLICY_BLOCKED", decision);

    if (requestedAction && !reversible && !authorization) {
      return this.#result("blocked", brain, intent, "AUTHORIZATION_REQUIRED", { decision });
    }

    return this.#result("completed", brain, intent, null, {
      action: requestedAction,
      decision,
      evidenceCount: evidence.length,
    });
  }

  status() {
    return {
      brains: this.registry.size,
      auditEntries: this.audit.length,
      healthy: true,
    };
  }

  #result(state, brain, intent, reason, extra = {}) {
    const result = {
      id: `${this.clock()}-${this.audit.length + 1}`,
      timestamp: this.clock(),
      state,
      brain,
      intent,
      reason,
      ...extra,
    };
    if (!TERMINAL.has(state)) throw new Error("INVALID_BRAIN_STATE");
    this.audit.push(result);
    return result;
  }
}

export function evidenceGate(evidence, required = []) {
  const have = new Set((evidence || []).map(item => item?.type));
  const missing = required.filter(type => !have.has(type));
  return missing.length ? { ok: false, reason: "MISSING_EVIDENCE", missing } : { ok: true };
}

export function healthPolicy({ facts = {}, evidence = [] }) {
  if (facts.live === true && facts.health !== "healthy") return { ok: false, reason: "LIVE_WITHOUT_HEALTH" };
  return evidenceGate(evidence, facts.requiredEvidence || []);
}
