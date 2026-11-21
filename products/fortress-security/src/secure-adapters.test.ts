import { describe, expect, it } from "vitest";
import { SecureAdapterRegistry, createSafeAdapter } from "./secure-adapters";

const decision = {
  id: "decision-1",
  tenantId: "tenant-a",
  action: "VERIFY",
  targetId: "asset-1",
  outcome: "ALLOW" as const,
  integrityHash: "a".repeat(64),
};

describe("SecureAdapterRegistry", () => {
  it("allows a matching safe adapter", () => {
    const registry = new SecureAdapterRegistry();
    registry.register(createSafeAdapter("safe-verify", "VERIFY"));
    const result = registry.execute({ tenantId: "tenant-a", actorId: "actor-1", requestedAction: "VERIFY", targetId: "asset-1", decision });
    expect(result.outcome).toBe("ALLOW");
    expect(result.adapterName).toBe("safe-verify");
  });

  it("fails closed for denied decisions", () => {
    const registry = new SecureAdapterRegistry();
    registry.register(createSafeAdapter("safe-verify", "VERIFY"));
    const result = registry.execute({ tenantId: "tenant-a", actorId: "actor-1", requestedAction: "VERIFY", targetId: "asset-1", decision: { ...decision, outcome: "DENY" } });
    expect(result.outcome).toBe("DENY");
  });

  it("denies tenant mismatch", () => {
    const registry = new SecureAdapterRegistry();
    registry.register(createSafeAdapter("safe-verify", "VERIFY"));
    const result = registry.execute({ tenantId: "tenant-b", actorId: "actor-1", requestedAction: "VERIFY", targetId: "asset-1", decision });
    expect(result.outcome).toBe("DENY");
  });

  it("denies action and target mismatch", () => {
    const registry = new SecureAdapterRegistry();
    registry.register(createSafeAdapter("safe-verify", "VERIFY"));
    expect(registry.execute({ tenantId: "tenant-a", actorId: "actor-1", requestedAction: "DELETE", targetId: "asset-1", decision }).outcome).toBe("DENY");
    expect(registry.execute({ tenantId: "tenant-a", actorId: "actor-1", requestedAction: "VERIFY", targetId: "asset-2", decision }).outcome).toBe("DENY");
  });

  it("denies unsupported actions and duplicate adapter names", () => {
    const registry = new SecureAdapterRegistry();
    registry.register(createSafeAdapter("safe-verify", "VERIFY"));
    expect(registry.execute({ tenantId: "tenant-a", actorId: "actor-1", requestedAction: "EXPORT", targetId: "asset-1", decision }).outcome).toBe("DENY");
    expect(() => registry.register(createSafeAdapter("safe-verify", "EXPORT"))).toThrow();
  });
});
