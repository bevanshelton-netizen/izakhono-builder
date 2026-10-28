import { createHash } from "node:crypto";

export type AdapterOutcome = "ALLOW" | "DENY";

export interface EnforcementDecision {
  id: string;
  tenantId: string;
  action: string;
  targetId: string;
  outcome: "ALLOW" | "DENY";
  integrityHash: string;
}

export interface ExecutionContext {
  tenantId: string;
  actorId: string;
  requestedAction: string;
  targetId: string;
  decision: EnforcementDecision;
  metadata?: Record<string, string>;
}

export interface AdapterResult {
  id: string;
  adapterName: string;
  tenantId: string;
  decisionId: string;
  outcome: AdapterOutcome;
  reason: string;
  createdAt: string;
  integrityHash: string;
}

export interface FortressExecutionAdapter {
  readonly name: string;
  readonly supportedActions: readonly string[];
  execute(context: ExecutionContext): AdapterResult;
}

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const canonical = (value: unknown): string => JSON.stringify(value, Object.keys(value as object).sort());

export function verifyDecisionIntegrity(decision: EnforcementDecision): boolean {
  if (!decision.id || !decision.tenantId || !decision.action || !decision.targetId) return false;
  if (!/^[a-f0-9]{64}$/.test(decision.integrityHash)) return false;
  return decision.integrityHash.length === 64;
}

export class SecureAdapterRegistry {
  private readonly adapters = new Map<string, FortressExecutionAdapter>();

  register(adapter: FortressExecutionAdapter): void {
    if (!adapter.name || adapter.supportedActions.length === 0) throw new Error("Invalid adapter contract");
    if (this.adapters.has(adapter.name)) throw new Error(`Adapter already registered: ${adapter.name}`);
    this.adapters.set(adapter.name, adapter);
  }

  resolve(action: string): FortressExecutionAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.supportedActions.includes(action)) return adapter;
    }
    return undefined;
  }

  execute(context: ExecutionContext, now = new Date().toISOString()): AdapterResult {
    const deny = (reason: string, adapterName = "none"): AdapterResult => {
      const base = { adapterName, tenantId: context.tenantId, decisionId: context.decision.id, outcome: "DENY" as const, reason, createdAt: now };
      return { ...base, id: digest(canonical(base)), integrityHash: digest(canonical(base)) };
    };

    if (context.decision.outcome !== "ALLOW") return deny("Enforcement decision is not ALLOW");
    if (!verifyDecisionIntegrity(context.decision)) return deny("Enforcement decision integrity is invalid");
    if (context.decision.tenantId !== context.tenantId) return deny("Tenant context does not match decision");
    if (context.decision.action !== context.requestedAction) return deny("Requested action does not match decision");
    if (context.decision.targetId !== context.targetId) return deny("Target context does not match decision");

    const adapter = this.resolve(context.requestedAction);
    if (!adapter) return deny("No registered adapter supports the requested action");

    const result = adapter.execute(context);
    if (result.tenantId !== context.tenantId || result.decisionId !== context.decision.id) {
      return deny("Adapter returned an invalid security context", adapter.name);
    }
    return result;
  }
}

export const createSafeAdapter = (name: string, action: string): FortressExecutionAdapter => ({
  name,
  supportedActions: [action],
  execute: (context) => {
    const base = {
      adapterName: name,
      tenantId: context.tenantId,
      decisionId: context.decision.id,
      outcome: "ALLOW" as const,
      reason: "Safe adapter contract executed; no external side effect performed",
      createdAt: new Date().toISOString(),
    };
    return { ...base, id: digest(canonical(base)), integrityHash: digest(canonical(base)) };
  },
});
