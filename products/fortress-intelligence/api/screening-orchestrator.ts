import { evaluateRisk } from "./risk-engine";
import { EvidenceStore } from "./evidence-store";
import { ProviderAdapter, SearchEntity, ScreeningDecision } from "./provider-contract";

export interface ScreeningResult {
  screeningId: string;
  mode: "synthetic" | "live";
  providerResults: number;
  evidenceIds: string[];
  decision: ScreeningDecision;
}

export class ScreeningOrchestrator {
  constructor(private readonly providers: ProviderAdapter[], private readonly evidenceStore: EvidenceStore) {}

  async screen(tenantId: string, entity: SearchEntity, mode: "synthetic" | "live" = "synthetic"): Promise<ScreeningResult> {
    if (mode === "live") throw new Error("LIVE_PROVIDER_GATE_REQUIRED: production provider approval is required before live screening.");

    const results = (await Promise.all(this.providers.map((provider) => provider.match(entity)))).flat();
    const evidenceIds = results.flatMap((result) => result.evidence.map((evidence) => this.evidenceStore.put(tenantId, evidence).id));
    const evidence = evidenceIds.map((id) => this.evidenceStore.get(id, tenantId)).filter(Boolean) as NonNullable<ReturnType<EvidenceStore["get"]>>[];
    const decision = evaluateRisk(evidence);

    return {
      screeningId: `screen-${Date.now()}`,
      mode,
      providerResults: results.length,
      evidenceIds,
      decision,
    };
  }
}
