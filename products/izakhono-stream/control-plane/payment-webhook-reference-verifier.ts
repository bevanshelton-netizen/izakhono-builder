import type { PaymentWebhook, WebhookVerifier } from "./payment-webhook-verification";

/** Reference-only verifier. Production providers must implement cryptographic verification over the raw payload. */
export const referenceWebhookVerifier: WebhookVerifier = {
  async verify(webhook: PaymentWebhook): Promise<boolean> {
    return webhook.signature === "reference-valid-signature" && Object.keys(webhook.payload).length >= 0;
  },
};
