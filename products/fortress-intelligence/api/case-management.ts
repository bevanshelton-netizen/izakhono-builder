export type CaseStatus = "open" | "under_review" | "escalated" | "cleared" | "closed";
export type Disposition = "false_positive" | "needs_information" | "confirmed_match" | "escalated" | "cleared" | "unable_to_determine";

export interface CaseEvent {
  at: string;
  actor: string;
  action: string;
  details?: string;
}

export interface FortressCase {
  id: string;
  tenantId: string;
  subject: { type: "person" | "organization"; name: string };
  status: CaseStatus;
  disposition?: Disposition;
  evidenceIds: string[];
  events: CaseEvent[];
  createdAt: string;
  updatedAt: string;
}

export class CaseManager {
  private cases = new Map<string, FortressCase>();

  create(tenantId: string, subject: FortressCase["subject"], evidenceIds: string[], actor = "system") {
    const now = new Date().toISOString();
    const id = `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: FortressCase = {
      id, tenantId, subject, evidenceIds, status: "open",
      events: [{ at: now, actor, action: "case_created" }], createdAt: now, updatedAt: now,
    };
    this.cases.set(id, item);
    return item;
  }

  get(tenantId: string, id: string) {
    const item = this.cases.get(id);
    return item?.tenantId === tenantId ? item : undefined;
  }

  decide(tenantId: string, id: string, disposition: Disposition, actor: string) {
    const item = this.get(tenantId, id);
    if (!item) throw new Error("CASE_NOT_FOUND");
    const now = new Date().toISOString();
    item.disposition = disposition;
    item.status = disposition === "cleared" || disposition === "false_positive" ? "cleared" : disposition === "escalated" ? "escalated" : "closed";
    item.updatedAt = now;
    item.events.push({ at: now, actor, action: "case_decision", details: disposition });
    return item;
  }
}
