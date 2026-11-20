import {
  EvidenceService,
  MemoryVerificationRepository,
  type EvidenceIntentStore,
  type EvidenceUploadIntent,
  type VerificationRequest,
} from "../src/index.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  const repository = new MemoryVerificationRepository();
  const request: VerificationRequest = {
    id: "request-1",
    tenantId: "tenant-1",
    subjectRef: "opaque-subject-1",
    purpose: "customer_onboarding",
    requiredChecks: ["document_authenticity"],
    completedChecks: [],
    failedChecks: [],
    requestFingerprint: "a".repeat(64),
    status: "in_progress",
    legalBasis: "approved_basis",
    noticeVersion: "notice-v1",
    authorisationReference: "authorisation-1",
    providerId: "test-provider",
    providerReference: "provider-ref-1",
    idempotencyKey: "idempotency-1",
    createdBy: "operator-1",
    createdAt: "2026-11-20T12:00:00.000Z",
    updatedAt: "2026-11-20T12:00:00.000Z",
    expiresAt: "2026-11-21T12:00:00.000Z",
  };
  await repository.createRequest(request);

  const intents = new Map<string, EvidenceUploadIntent>();
  const finalised = new Set<string>();
  const intentStore: EvidenceIntentStore = {
    async create(intent) { intents.set(intent.id, structuredClone(intent)); },
    async find(id) { const value = intents.get(id); return value ? structuredClone(value) : null; },
    async markFinalizedOnce(id) {
      if (finalised.has(id)) return false;
      finalised.add(id);
      return true;
    },
  };
  const storage = {
    async createPrivateUpload() {
      return { uploadUrl: "https://private-storage.example.invalid/signed-upload", objectRef: "tenant-1/request-1/evidence-1" };
    },
    async inspectPrivateObject() {
      return { exists: true, contentType: "image/jpeg", sizeBytes: 1024, sha256: "a".repeat(64) };
    },
  };
  const clock = { now: () => new Date("2026-11-20T12:00:00.000Z") };
  let sequence = 0;
  const ids = { create: () => "evidence-" + (++sequence) };
  const service = new EvidenceService(repository, storage, intentStore, clock, ids);
  const principal = {
    userId: "operator-1",
    roles: [],
    tenantMemberships: [{
      tenantId: "tenant-1",
      permissions: ["identity:verify:create"],
      status: "active" as const,
    }],
  };

  const intent = await service.createUploadIntent(principal, {
    tenantId: "tenant-1",
    requestId: "request-1",
    kind: "identity_document",
    contentType: "image/jpeg",
    sizeBytes: 1024,
  });
  assert(intent.uploadUrl.startsWith("https://"), "upload URL must use HTTPS");
  const saved = await service.finaliseUpload(principal, intent.intentId);
  assert(saved.contentSha256 === "a".repeat(64), "evidence digest should be stored");
  assert(repository.evidence.length === 1, "evidence metadata should be persisted");
  assert(!("image" in saved), "raw evidence must not be returned or stored in metadata");

  let oversizedRejected = false;
  try {
    await service.createUploadIntent(principal, {
      tenantId: "tenant-1", requestId: "request-1", kind: "identity_document",
      contentType: "image/jpeg", sizeBytes: 99_000_000,
    });
  } catch {
    oversizedRejected = true;
  }
  assert(oversizedRejected, "oversized evidence must be rejected");

  console.log("IZAKHONO IDENTITY evidence tests passed");
}

run().catch((error) => {
  console.error(error);
  throw error;
});
