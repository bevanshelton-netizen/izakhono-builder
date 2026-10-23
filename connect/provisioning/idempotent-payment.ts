import {
  confirmPaymentAndStartProvisioning,
  type ConnectProvisioningRepository,
  type OrchestrationResult,
  type PaymentEvent,
} from "./orchestrator";

const UNIQUE_VIOLATION = "23505";

type RepositoryError = Error & { code?: string; status?: number };

/**
 * Runs payment confirmation with a database uniqueness guard as the final
 * concurrency boundary. If two workers race on the same webhook, the loser
 * re-reads the canonical payment/provisioning records instead of creating a
 * second execution path.
 */
export async function confirmPaymentIdempotently(
  repository: ConnectProvisioningRepository,
  event: PaymentEvent,
): Promise<OrchestrationResult> {
  try {
    return await confirmPaymentAndStartProvisioning(repository, event);
  } catch (error) {
    const candidate = error as RepositoryError;
    if (candidate.code !== UNIQUE_VIOLATION && candidate.status !== 409) {
      throw error;
    }

    const existingEvent = await repository.findPaymentEvent(
      event.orderId,
      event.externalEventId,
    );
    const existingProvisioning = await repository.getProvisioning(event.orderId);

    if (!existingEvent || !existingProvisioning) {
      throw error;
    }

    return { duplicate: true, provisioning: existingProvisioning };
  }
}
