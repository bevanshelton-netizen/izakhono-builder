export type EntityType = "person" | "organization";

export interface SearchEntity {
  type: EntityType;
  name: string;
  country?: string;
  dateOfBirth?: string;
  registrationNumber?: string;
  identifiers?: Record<string, string>;
}

export interface EvidenceRecord {
  provider: string;
  sourceDataset?: string;
  sourceReference?: string;
  providerEntityId?: string;
  observedAt: string;
  retrievedAt: string;
  matchMethod: string;
  confidence: number;
  matchedAttributes: string[];
  jurisdiction?: string;
  licenceClass?: string;
  evidenceHash?: string;
}

export interface ProviderResult {
  provider: string;
  entityId?: string;
  matched: boolean;
  confidence: number;
  evidence: EvidenceRecord[];
  raw?: unknown;
}

export interface ProviderAdapter {
  health(): Promise<{ ok: boolean; provider: string; mode: string }>;
  capabilities(): string[];
  search(entity: SearchEntity): Promise<ProviderResult[]>;
  match(entity: SearchEntity): Promise<ProviderResult[]>;
  getEntity(id: string): Promise<ProviderResult | null>;
  getSources(id: string): Promise<EvidenceRecord[]>;
  usage(): Promise<{ used?: number; limit?: number }>;
}

export type RiskReasonCode =
  | "SANCTIONS_SIGNAL"
  | "PEP_SIGNAL"
  | "ADVERSE_MEDIA_SIGNAL"
  | "OWNERSHIP_LINK"
  | "IDENTITY_AMBIGUITY"
  | "DATA_INSUFFICIENT";

export interface RiskSignal {
  code: RiskReasonCode;
  severity: "low" | "medium" | "high";
  explanation: string;
  evidenceIds: string[];
}

export interface ScreeningDecision {
  status: "clear" | "review" | "escalated" | "unable_to_determine";
  signals: RiskSignal[];
  requiresHumanReview: boolean;
}
