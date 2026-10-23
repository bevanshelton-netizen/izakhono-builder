import {
  initialProvisioningState,
  transition,
  type ProvisioningState,
} from "./state-machine";

export type PaymentEvent = {
  orderId: string;
  externalEventId: string;
  status: string;
  amount?: number;
  currency?: string;
};

export type ProvisioningRecord = {
  id: string;
  orderId: string;
  state: ProvisioningState;
};

/**
 * Persistence boundary for the CONNECT orchestration engine.
 *
 * The implementation is deliberately injected so the state machine does not
 * depend on Supabase client details, and can be exercised without network
 * calls. A production repository should map these operations to
 * iz_connect_payment_events, iz_connect_provisioning and
 * iz_connect_provisioning_steps.
 */
export interface ConnectProvisioningRepository {
  findPaymentEvent(orderId: string, externalEventId: string): Promise<PaymentEvent | null>;
  recordPaymentEvent(event: PaymentEvent): Promise<void>;
  getProvisioning(orderId: string): Promise<ProvisioningRecord | null>;
  createProvisioning(orderId: string, state: ProvisioningState): Promise<ProvisioningRecord>;
  updateProvisioning(record: ProvisioningRecord): Promise<void>;
}

export type OrchestrationResult = {
  duplicate: boolean;
  provisioning: ProvisioningRecord;
};

/**
 * Idempotently moves a paid CONNECT order from payment to the first
 * provisioning state. Replayed payment-provider webhooks therefore cannot
 * create a second provisioning record or advance the state twice.
 */
export async function confirmPaymentAndStartProvisioning(
  repository: ConnectProvisioningRepository,
  event: PaymentEvent,
): Promise<OrchestrationResult> {
  const existingEvent = await repository.findPaymentEvent(
    event.orderId,
    event.externalEventId,
  );

  const existingProvisioning = await repository.getProvisioning(event.orderId);

  if (existingEvent) {
    if (!existingProvisioning) {
      throw new Error(
        "Payment event is already recorded but its provisioning record is missing",
      );
    }
    return { duplicate: true, provisioning: existingProvisioning };
  }

  if (event.status !== "paid" && event.status !== "confirmed" && event.status !== "success") {
    throw new Error(`Payment is not confirmed: ${event.status}`);
  }

  await repository.recordPaymentEvent(event);

  if (existingProvisioning) {
    return { duplicate: false, provisioning: existingProvisioning };
  }

  const state = transition(initialProvisioningState(), "PAYMENT_CONFIRMED");
  const provisioning = await repository.createProvisioning(event.orderId, state);
  return { duplicate: false, provisioning };
}
