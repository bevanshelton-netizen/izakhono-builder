export type ProvisioningStatus =
  | "pending_payment"
  | "payment_confirmed"
  | "coverage_pending"
  | "coverage_confirmed"
  | "order_pending"
  | "service_pending"
  | "active"
  | "blocked"
  | "cancelled";

export type ProvisioningEvent =
  | "PAYMENT_CONFIRMED"
  | "COVERAGE_REQUESTED"
  | "COVERAGE_CONFIRMED"
  | "COVERAGE_UNAVAILABLE"
  | "ORDER_SUBMITTED"
  | "ORDER_ACCEPTED"
  | "SERVICE_ACTIVE"
  | "PROVIDER_ERROR"
  | "CANCEL_REQUESTED"
  | "CANCELLED";

export interface ProvisioningState {
  status: ProvisioningStatus;
  currentStep: string;
  progress: number;
  providerReference?: string;
  blocker?: string;
}

const transitions: Record<ProvisioningStatus, Partial<Record<ProvisioningEvent, ProvisioningStatus>>> = {
  pending_payment: { PAYMENT_CONFIRMED: "payment_confirmed", CANCELLED: "cancelled" },
  payment_confirmed: { COVERAGE_REQUESTED: "coverage_pending", CANCELLED: "cancelled" },
  coverage_pending: {
    COVERAGE_CONFIRMED: "coverage_confirmed",
    COVERAGE_UNAVAILABLE: "blocked",
    PROVIDER_ERROR: "blocked",
    CANCELLED: "cancelled",
  },
  coverage_confirmed: { ORDER_SUBMITTED: "order_pending", CANCELLED: "cancelled" },
  order_pending: {
    ORDER_ACCEPTED: "service_pending",
    PROVIDER_ERROR: "blocked",
    CANCELLED: "cancelled",
  },
  service_pending: {
    SERVICE_ACTIVE: "active",
    PROVIDER_ERROR: "blocked",
    CANCELLED: "cancelled",
  },
  active: { CANCEL_REQUESTED: "service_pending", CANCELLED: "cancelled" },
  blocked: {
    COVERAGE_REQUESTED: "coverage_pending",
    ORDER_SUBMITTED: "order_pending",
    CANCELLED: "cancelled",
  },
  cancelled: {},
};

const progress: Record<ProvisioningStatus, number> = {
  pending_payment: 0,
  payment_confirmed: 20,
  coverage_pending: 30,
  coverage_confirmed: 45,
  order_pending: 60,
  service_pending: 80,
  active: 100,
  blocked: 0,
  cancelled: 0,
};

const step: Record<ProvisioningStatus, string> = {
  pending_payment: "payment",
  payment_confirmed: "payment",
  coverage_pending: "coverage",
  coverage_confirmed: "coverage",
  order_pending: "provider_order",
  service_pending: "service_activation",
  active: "completed",
  blocked: "exception",
  cancelled: "cancelled",
};

export function transition(
  state: ProvisioningState,
  event: ProvisioningEvent,
  details: Pick<ProvisioningState, "providerReference" | "blocker"> = {},
): ProvisioningState {
  const next = transitions[state.status][event];
  if (!next) {
    throw new Error(`Invalid provisioning transition: ${state.status} + ${event}`);
  }

  return {
    status: next,
    currentStep: step[next],
    progress: progress[next],
    providerReference: details.providerReference ?? state.providerReference,
    blocker: next === "blocked" ? details.blocker ?? "Provider operation failed" : undefined,
  };
}

export function initialProvisioningState(): ProvisioningState {
  return { status: "pending_payment", currentStep: "payment", progress: 0 };
}
