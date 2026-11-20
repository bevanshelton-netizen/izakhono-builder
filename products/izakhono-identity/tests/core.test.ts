import {
  MemoryVerificationRepository,
  ProviderRouter,
  VerificationOrchestrator,
  AccessDeniedError,
  type Clock,
  type VerificationProvider,
  type CreateVerificationInput,
  type ProviderVerificationResult,
} from "../src/index.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const fixedNow = new Date("2026-11-20T12:00:00.000Z");
const clock: Clock = { now: () => new Date(fixedNow) };
let sequence = 0;
const ids = { create: () => "id-" + (++sequence) };

const provider: VerificationProvider = {
  id: "test-provider",
  enabled: true,
  capabilities: {
    checks: ["document_authenticity", "document_data"],
    countries: ["ZA"],
    documentTypes: ["za_id_smart_card"],
    supportsWebhook: false,
    supportsNfc: false,
  },
  async start(input) {
    return {
      providerId: "test-provider",
      providerReference: "ref-" + input.requestId,
      status: "started",
    };
  },
  parseResult() {
    throw new Error("Not used in this test");
  },
};

async function run(): Promise<void> {
  const repository = new MemoryVerificationRepository();
  const router = new ProviderRouter([provider]);
  const service = new VerificationOrchestrator(
    repository,
    router,
    clock,
    ids,
    () => ({ preferredProviderId: "test-provider", fallbackProviderIds: [], requiredCountry: "ZA" }),
  );
  const principal = {
    userId: "operator-1",
    roles: [],
    tenantMemberships: [{
      tenantId: "tenant-1",
      permissions: ["identity:verify:create", "identity:verify:review"],
      status: "active" as const,
    }],
  };
  const input: CreateVerificationInput = {
    tenantId: "tenant-1",
    subjectRef: "subject-pseudonymous-1",
    purpose: "customer_onboarding" as const,
    requiredChecks: ["document_authenticity", "document_data"],
    countryCode: "ZA",
    idempotencyKey: "once-1",
    expiresAt: "2026-11-21T12:00:00.000Z",
    processingAuthorisation: {
      legalBasis: "approved_test_basis",
      noticeVersion: "test-notice-v1",
      authorisationReference: "test-authorisation-1",
      confirmedAt: "2026-11-20T11:59:00.000Z",
    },
  };

  const created = await service.create(principal, input, "ZA");
  assert(created.status === "in_progress", "request should start");
  assert(Number(repository.audits.length) === 2, "creation and provider routing should be audited");

  const replay = await service.create(principal, input, "ZA");
  assert(replay.id === created.id, "idempotent replay should return existing request");

  let idempotencyConflict = false;
  try {
    await service.create(principal, { ...input, subjectRef: "different-subject" }, "ZA");
  } catch {
    idempotencyConflict = true;
  }
  assert(idempotencyConflict, "same idempotency key with a different request must be rejected");

  const result: ProviderVerificationResult = {
    providerId: "test-provider",
    providerReference: created.providerReference!,
    status: "verified" as const,
    completedChecks: ["document_authenticity", "document_data"],
    failedChecks: [],
    reasonCodes: [],
    completedAt: "2026-11-20T12:01:00.000Z",
  };
  const completed = await service.recordResult(principal, created.id, result);
  assert(completed.status === "verified", "provider result should be normalised");
  assert(Number(repository.audits.length) === 3, "result should be audited");

  const reviewRequest = await service.create(principal, { ...input, idempotencyKey: "manual-review-1" }, "ZA");
  const reviewResult: ProviderVerificationResult = {
    providerId: "test-provider",
    providerReference: reviewRequest.providerReference!,
    status: "manual_review",
    completedChecks: ["document_authenticity", "document_data"],
    failedChecks: [],
    reasonCodes: ["low_confidence"],
    completedAt: "2026-11-20T12:02:00.000Z",
  };
  await service.recordResult(principal, reviewRequest.id, reviewResult);
  const manuallyApproved = await service.recordManualReview(principal, reviewRequest.id, "verified", "reviewer_confirmed");
  assert(manuallyApproved.status === "verified", "manual reviewer can approve complete evidence");

  let denied = false;
  try {
    await service.create({ userId: "outsider", roles: [], tenantMemberships: [] }, {
      ...input,
      idempotencyKey: "outsider-1",
    }, "ZA");
  } catch (error) {
    denied = error instanceof AccessDeniedError;
  }
  assert(denied, "cross-tenant request must be denied");

  console.log("IZAKHONO IDENTITY core tests passed");
}

run().catch((error) => {
  console.error(error);
  throw error;
});
