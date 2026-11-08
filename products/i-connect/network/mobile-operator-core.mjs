import { randomUUID } from "node:crypto";

/**
 * IZAKHONO I-CONNECT mobile operator control layer.
 *
 * This module owns order validation, readiness gates and lifecycle rules.
 * It deliberately does not pretend to create radio coverage or activate a
 * subscriber without a verified network adapter and upstream confirmation.
 */

export const MOBILE_ORDER_TYPES = Object.freeze([
  "SIM_NEW",
  "ESIM_NEW",
  "DATA_BUNDLE",
  "AIRTIME",
  "PLAN_CHANGE",
  "SUSPEND",
  "RESUME",
  "TERMINATE",
]);

export const MOBILE_SERVICE_STATES = Object.freeze([
  "DRAFT",
  "KYC_PENDING",
  "READY",
  "SUBMITTED",
  "PROVISIONING",
  "ACTIVE",
  "SUSPENDED",
  "TERMINATION_PENDING",
  "TERMINATED",
  "FAILED",
  "MANUAL_REVIEW",
]);

const TRANSITIONS = Object.freeze({
  DRAFT: ["KYC_PENDING", "READY", "FAILED"],
  KYC_PENDING: ["READY", "FAILED", "MANUAL_REVIEW"],
  READY: ["SUBMITTED", "FAILED", "MANUAL_REVIEW"],
  SUBMITTED: ["PROVISIONING", "FAILED", "MANUAL_REVIEW"],
  PROVISIONING: ["ACTIVE", "FAILED", "MANUAL_REVIEW"],
  ACTIVE: ["SUSPENDED", "TERMINATION_PENDING", "MANUAL_REVIEW"],
  SUSPENDED: ["ACTIVE", "TERMINATION_PENDING", "MANUAL_REVIEW"],
  TERMINATION_PENDING: ["TERMINATED", "FAILED", "MANUAL_REVIEW"],
  FAILED: ["READY", "MANUAL_REVIEW"],
  MANUAL_REVIEW: ["READY", "FAILED", "TERMINATED"],
  TERMINATED: [],
});

const MVNO_GATES = Object.freeze([
  "commercialAgreementVerified",
  "apiContractVerified",
  "sandboxCredentialsVerified",
  "productionCredentialsVerified",
  "wholesalePricebookApproved",
  "coverageAndProductFeedVerified",
  "ricaWorkflowApproved",
  "settlementAndWalletTermsApproved",
  "securityAndPopiaReviewPassed",
  "regulatoryModelReviewed",
]);

const OWNED_NETWORK_GATES = Object.freeze([
  "ecsEcnsAuthorisationsConfirmed",
  "spectrumRightsConfirmed",
  "ranDeployedAndAccepted",
  "mobileCoreDeployedAndHardened",
  "interconnectAndBackhaulAccepted",
  "subscriberIdentityAndSimProvisioningAccepted",
  "chargingAndPolicySystemsAccepted",
  "emergencyAndNumberingObligationsAccepted",
  "nocAndIncidentResponseOperational",
  "securityAndPopiaReviewPassed",
  "regulatoryModelReviewed",
]);

function requireValue(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new TypeError(`${name} is required`);
  }
}

function assertZarCents(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError("amountZarCents must be a positive integer");
  }
}

export function evaluateMobileReadiness({
  deliveryModel = "mvno",
  environment = "sandbox",
  evidence = {},
} = {}) {
  if (!["mvno", "owned_network"].includes(deliveryModel)) {
    throw new TypeError("deliveryModel must be mvno or owned_network");
  }
  if (!["sandbox", "production"].includes(environment)) {
    throw new TypeError("environment must be sandbox or production");
  }

  const required = deliveryModel === "mvno" ? MVNO_GATES : OWNED_NETWORK_GATES;
  const missing = required.filter((gate) => evidence[gate] !== true);

  // A sandbox can exercise test adapters, but must never be presented as a
  // production-ready service. Production readiness is evidence-gated.
  const productionReady = environment === "production" && missing.length === 0;
  return Object.freeze({
    deliveryModel,
    environment,
    ready: missing.length === 0,
    productionReady,
    missingEvidence: missing,
    checkedAt: new Date().toISOString(),
  });
}

export function assertMobileDispatchAllowed({
  deliveryModel = "mvno",
  environment = "sandbox",
  provider = {},
  evidence = {},
} = {}) {
  const readiness = evaluateMobileReadiness({ deliveryModel, environment, evidence });

  if (environment !== "production") {
    if (provider.environment !== "sandbox" || provider.isSimulator !== true) {
      throw new Error("sandbox_dispatch_requires_explicit_simulator_adapter");
    }
    return readiness;
  }

  if (!readiness.productionReady) {
    throw new Error("mobile_production_readiness_incomplete");
  }
  if (provider.environment !== "production" || provider.isSimulator === true) {
    throw new Error("production_dispatch_requires_non_simulator_production_adapter");
  }
  if (provider.status !== "ACTIVE" || provider.productionApproved !== true) {
    throw new Error("production_provider_not_approved");
  }
  return readiness;
}

export function createMobileOrder({
  customerId,
  serviceId,
  orderType,
  productCode,
  idempotencyKey,
  amountZarCents,
  deliveryModel = "mvno",
  metadata = {},
} = {}) {
  requireValue(customerId, "customerId");
  requireValue(serviceId, "serviceId");
  requireValue(productCode, "productCode");
  requireValue(idempotencyKey, "idempotencyKey");

  if (!MOBILE_ORDER_TYPES.includes(orderType)) {
    throw new TypeError("unsupported_mobile_order_type");
  }
  if (["DATA_BUNDLE", "AIRTIME"].includes(orderType)) {
    assertZarCents(amountZarCents);
  }
  if (!["mvno", "owned_network"].includes(deliveryModel)) {
    throw new TypeError("unsupported_delivery_model");
  }

  return Object.freeze({
    orderId: randomUUID(),
    customerId,
    serviceId,
    orderType,
    productCode,
    idempotencyKey,
    amountZarCents: amountZarCents ?? null,
    currency: "ZAR",
    deliveryModel,
    state: "READY",
    metadata: structuredClone(metadata),
    createdAt: new Date().toISOString(),
  });
}

export function transitionMobileService(service, nextState, evidence = {}) {
  requireValue(service?.id, "service.id");
  if (!MOBILE_SERVICE_STATES.includes(service.state)) {
    throw new TypeError("unknown_current_service_state");
  }
  if (!MOBILE_SERVICE_STATES.includes(nextState)) {
    throw new TypeError("unknown_next_service_state");
  }
  if (!TRANSITIONS[service.state].includes(nextState)) {
    throw new Error(`invalid_mobile_service_transition:${service.state}->${nextState}`);
  }

  if (nextState === "ACTIVE") {
    if (evidence.providerConfirmed !== true || !evidence.externalReference) {
      throw new Error("activation_requires_verified_provider_confirmation");
    }
  }
  if (nextState === "TERMINATED" && evidence.terminationConfirmed !== true) {
    throw new Error("termination_requires_provider_confirmation");
  }

  return Object.freeze({
    ...service,
    state: nextState,
    externalReference: evidence.externalReference ?? service.externalReference ?? null,
    lastTransitionAt: new Date().toISOString(),
    transitionEvidence: structuredClone(evidence),
  });
}

export function createMobileProvisioningEnvelope({ order, providerCode, environment, attempt = 1 } = {}) {
  requireValue(order?.orderId, "order.orderId");
  requireValue(order?.idempotencyKey, "order.idempotencyKey");
  requireValue(providerCode, "providerCode");
  if (!["sandbox", "production"].includes(environment)) {
    throw new TypeError("invalid_environment");
  }
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 5) {
    throw new TypeError("attempt must be between 1 and 5");
  }

  return Object.freeze({
    correlationId: randomUUID(),
    orderId: order.orderId,
    idempotencyKey: order.idempotencyKey,
    providerCode,
    environment,
    attempt,
    operation: order.orderType,
    requestedAt: new Date().toISOString(),
  });
}
