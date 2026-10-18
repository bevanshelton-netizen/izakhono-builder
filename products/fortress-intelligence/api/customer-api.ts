import { CaseManager } from "./case-management";
import { EvidenceStore } from "./evidence-store";
import { MockProvider } from "./mock-provider";
import { ScreeningOrchestrator } from "./screening-orchestrator";
import { SearchEntity } from "./provider-contract";

export interface ApiResponse<T> { ok: boolean; data?: T; error?: string; }

export class FortressCustomerApi {
  private readonly evidence = new EvidenceStore();
  private readonly cases = new CaseManager();
  private readonly screening = new ScreeningOrchestrator([new MockProvider()], this.evidence);

  async screen(tenantId: string, entity: SearchEntity): Promise<ApiResponse<Awaited<ReturnType<ScreeningOrchestrator["screen"]>>>> {
    try { return { ok: true, data: await this.screening.screen(tenantId, entity, "synthetic") }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "SCREENING_FAILED" }; }
  }

  createCase(tenantId: string, subject: { type: "person" | "organization"; name: string }, evidenceIds: string[]) {
    return { ok: true, data: this.cases.create(tenantId, subject, evidenceIds) };
  }

  getCase(tenantId: string, id: string) {
    const item = this.cases.get(tenantId, id);
    return item ? { ok: true, data: item } : { ok: false, error: "CASE_NOT_FOUND" };
  }

  decideCase(tenantId: string, id: string, disposition: Parameters<CaseManager["decide"]>[2], actor: string) {
    try { return { ok: true, data: this.cases.decide(tenantId, id, disposition, actor) }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "CASE_DECISION_FAILED" }; }
  }
}
