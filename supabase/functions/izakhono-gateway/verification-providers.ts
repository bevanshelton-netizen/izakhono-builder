export type ProviderCapability =
  | "document_authenticity"
  | "face_match"
  | "liveness"
  | "company_registry"
  | "sanctions"
  | "pep"
  | "adverse_media";

export type ProviderOutcome =
  | "clear"
  | "potential_match"
  | "confirmed_match"
  | "inconclusive"
  | "unavailable"
  | "error";

export type ProviderCheckStatus = "passed" | "failed" | "inconclusive" | "not_performed";

export type ProviderRequest = {
  verificationId: string;
  caseId: string;
  entityId: string;
  membershipId: string;
  evidenceId: string;
  evidenceSha256: string;
  storageObjectRef: string;
  countryCode: string;
  correlationId: string;
};

export type ProviderCheck = {
  code: string;
  status: ProviderCheckStatus;
};

export type ProviderEvidence = {
  providerCode: string;
  capability: ProviderCapability;
  outcome: ProviderOutcome;
  providerTransactionRef: string | null;
  evidenceSha256: string;
  resultSha256: string | null;
  checks: ProviderCheck[];
  checkedAt: string;
  expiresAt: string | null;
  requiresReview: boolean;
};

export type ProviderHealth = {
  status: "ready" | "unavailable" | "not_configured";
  checkedAt: string;
  version: string | null;
};

export type RegulaAssessment = {
  outcome: ProviderOutcome;
  transactionRef?: string | null;
  resultSha256?: string | null;
  checks?: ProviderCheck[];
  expiresAt?: string | null;
};

export interface RegulaTransport {
  healthCheck(): Promise<{ status: "ready" | "unavailable"; version?: string | null }>;
  verifyDocument(request: ProviderRequest): Promise<RegulaAssessment>;
  verifyFaceMatch(request: ProviderRequest): Promise<RegulaAssessment>;
  verifyLiveness(request: ProviderRequest): Promise<RegulaAssessment>;
}

export interface VerificationProviderAdapter {
  readonly code: string;
  readonly capabilities: readonly ProviderCapability[];
  isConfigured(): boolean;
  healthCheck(): Promise<ProviderHealth>;
  verifyDocument(request: ProviderRequest): Promise<ProviderEvidence>;
  verifyFaceMatch(request: ProviderRequest): Promise<ProviderEvidence>;
  verifyLiveness(request: ProviderRequest): Promise<ProviderEvidence>;
}

const SHA256 = /^[0-9a-f]{64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^(usr|ent|mem)_[0-9a-f]{32}$/i;

function validateRequest(request: ProviderRequest) {
  if (!UUID.test(request.verificationId) || !UUID.test(request.caseId) ||
      !ID.test(request.entityId) || !ID.test(request.membershipId) ||
      !UUID.test(request.evidenceId) || !UUID.test(request.correlationId) ||
      !SHA256.test(request.evidenceSha256) ||
      !/^[A-Z]{2}$/.test(request.countryCode) ||
      !request.storageObjectRef || request.storageObjectRef.length > 1024) {
    throw new Error("invalid_provider_request");
  }
}

function sanitiseAssessment(
  capability: ProviderCapability,
  request: ProviderRequest,
  assessment: RegulaAssessment,
): ProviderEvidence {
  const allowed: ProviderOutcome[] = [
    "clear", "potential_match", "confirmed_match", "inconclusive", "unavailable", "error",
  ];
  const checks = Array.isArray(assessment.checks)
    ? assessment.checks.filter((c) =>
      c && /^[A-Z0-9_.-]{1,80}$/.test(c.code) &&
      ["passed", "failed", "inconclusive", "not_performed"].includes(c.status)
    ).slice(0, 100)
    : [];

  let outcome = allowed.includes(assessment.outcome) ? assessment.outcome : "inconclusive";
  if (outcome === "clear" &&
      (!checks.length || checks.some((c) => c.status !== "passed"))) {
    outcome = "inconclusive";
  }

  const resultSha = assessment.resultSha256 && SHA256.test(assessment.resultSha256)
    ? assessment.resultSha256.toLowerCase()
    : null;

  if (outcome === "clear" && !resultSha) outcome = "inconclusive";

  const tx = typeof assessment.transactionRef === "string"
    ? assessment.transactionRef.slice(0, 200)
    : null;
  const expiry = typeof assessment.expiresAt === "string" &&
      Number.isFinite(Date.parse(assessment.expiresAt))
    ? new Date(assessment.expiresAt).toISOString()
    : null;

  return {
    providerCode: "regula",
    capability,
    outcome,
    providerTransactionRef: tx,
    evidenceSha256: request.evidenceSha256.toLowerCase(),
    resultSha256: resultSha,
    checks,
    checkedAt: new Date().toISOString(),
    expiresAt: expiry,
    requiresReview: outcome !== "clear",
  };
}

function unavailable(
  capability: ProviderCapability,
  request: ProviderRequest,
  outcome: "unavailable" | "error" = "unavailable",
): ProviderEvidence {
  return {
    providerCode: "regula",
    capability,
    outcome,
    providerTransactionRef: null,
    evidenceSha256: request.evidenceSha256.toLowerCase(),
    resultSha256: null,
    checks: [{ code: "PROVIDER_NOT_CONFIGURED", status: "not_performed" }],
    checkedAt: new Date().toISOString(),
    expiresAt: null,
    requiresReview: true,
  };
}

export class RegulaAdapter implements VerificationProviderAdapter {
  readonly code = "regula";
  readonly capabilities: readonly ProviderCapability[] = [
    "document_authenticity",
    "face_match",
    "liveness",
  ];

  private readonly transport: RegulaTransport | null;

  constructor(transport: RegulaTransport | null = null) {
    this.transport = transport;
  }

  isConfigured() {
    return this.transport !== null;
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.transport) {
      return { status: "not_configured", checkedAt: new Date().toISOString(), version: null };
    }
    try {
      const health = await this.transport.healthCheck();
      return {
        status: health.status,
        checkedAt: new Date().toISOString(),
        version: typeof health.version === "string" ? health.version.slice(0, 80) : null,
      };
    } catch {
      return { status: "unavailable", checkedAt: new Date().toISOString(), version: null };
    }
  }

  async verifyDocument(request: ProviderRequest) {
    return this.run("document_authenticity", request, (t, r) => t.verifyDocument(r));
  }

  async verifyFaceMatch(request: ProviderRequest) {
    return this.run("face_match", request, (t, r) => t.verifyFaceMatch(r));
  }

  async verifyLiveness(request: ProviderRequest) {
    return this.run("liveness", request, (t, r) => t.verifyLiveness(r));
  }

  private async run(
    capability: ProviderCapability,
    request: ProviderRequest,
    operation: (transport: RegulaTransport, request: ProviderRequest) => Promise<RegulaAssessment>,
  ): Promise<ProviderEvidence> {
    validateRequest(request);
    if (!this.transport) return unavailable(capability, request);
    try {
      const assessment = await operation(this.transport, request);
      return sanitiseAssessment(capability, request, assessment);
    } catch {
      return unavailable(capability, request, "error");
    }
  }
}

export class ProviderRegistry {
  private readonly providers = new Map<string, VerificationProviderAdapter>();

  register(provider: VerificationProviderAdapter) {
    if (!/^[a-z][a-z0-9_-]{1,39}$/.test(provider.code)) {
      throw new Error("invalid_provider_code");
    }
    if (this.providers.has(provider.code)) throw new Error("provider_already_registered");
    this.providers.set(provider.code, provider);
  }

  get(code: string) {
    return this.providers.get(code) || null;
  }

  resolve(code: string, capability: ProviderCapability) {
    const provider = this.get(code);
    if (!provider || !provider.isConfigured() || !provider.capabilities.includes(capability)) {
      return null;
    }
    return provider;
  }

  list() {
    return [...this.providers.values()].map((p) => ({
      code: p.code,
      capabilities: [...p.capabilities],
      configured: p.isConfigured(),
    }));
  }
}

export function createDefaultProviderRegistry() {
  const registry = new ProviderRegistry();
  registry.register(new RegulaAdapter());
  return registry;
}
