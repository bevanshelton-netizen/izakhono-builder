import { createHash } from "node:crypto";
import { EvidenceRecord } from "./provider-contract";

export interface StoredEvidence extends EvidenceRecord {
  id: string;
  tenantId: string;
  createdAt: string;
}

/** Replace with encrypted persistent storage in production. */
export class EvidenceStore {
  private records = new Map<string, StoredEvidence>();

  put(tenantId: string, evidence: EvidenceRecord): StoredEvidence {
    const payload = JSON.stringify({ tenantId, evidence });
    const id = createHash("sha256").update(payload).digest("hex").slice(0, 24);
    const record: StoredEvidence = { ...evidence, id, tenantId, createdAt: new Date().toISOString() };
    this.records.set(id, record);
    return record;
  }

  get(id: string, tenantId: string) {
    const record = this.records.get(id);
    return record?.tenantId === tenantId ? record : undefined;
  }

  list(tenantId: string) {
    return [...this.records.values()].filter((record) => record.tenantId === tenantId);
  }
}
