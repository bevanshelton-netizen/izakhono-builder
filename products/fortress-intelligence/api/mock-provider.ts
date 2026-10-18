import { ProviderAdapter, ProviderResult, SearchEntity } from "./provider-contract";

/** Synthetic-only adapter for demos, automated tests and development. */
export class MockProvider implements ProviderAdapter {
  async health() { return { ok: true, provider: "mock", mode: "synthetic" }; }
  capabilities() { return ["search", "match", "evidence"]; }

  private result(entity: SearchEntity): ProviderResult {
    const now = new Date().toISOString();
    return {
      provider: "mock",
      entityId: `synthetic-${entity.type}-${entity.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      matched: true,
      confidence: 0.93,
      evidence: [{
        provider: "mock",
        sourceDataset: "FORTRESS Synthetic Demo Dataset",
        sourceReference: "synthetic://fortress/demo",
        providerEntityId: `synthetic-${entity.type}`,
        observedAt: now,
        retrievedAt: now,
        matchMethod: "synthetic_exact_demo_match",
        confidence: 0.93,
        matchedAttributes: ["name"],
        jurisdiction: entity.country,
        licenceClass: "synthetic-only",
      }],
    };
  }

  async search(entity: SearchEntity) { return [this.result(entity)]; }
  async match(entity: SearchEntity) { return [this.result(entity)]; }
  async getEntity(id: string) { return id.startsWith("synthetic-") ? this.result({ type: "person", name: id }) : null; }
  async getSources(id: string) { const result = await this.getEntity(id); return result?.evidence ?? []; }
  async usage() { return {}; }
}
