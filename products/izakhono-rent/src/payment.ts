export type PaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded";

export interface PaymentIntent {
  idempotencyKey: string;
  bookingId: string;
  amount: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PaymentSession {
  provider: "ikhokha";
  providerReference: string;
  checkoutUrl: string;
  status: PaymentStatus;
}

export interface PaymentCallback {
  providerReference: string;
  eventId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  rawBody: string;
  signature: string;
}

export interface PaymentAdapter {
  createPayment(intent: PaymentIntent): Promise<PaymentSession>;
  verifyCallback(callback: PaymentCallback): boolean;
}

/**
 * iKhokha adapter boundary.
 *
 * iK Pay API is the supported custom-platform integration. Exact endpoint,
 * request and callback-signing details must come from the merchant's current
 * iKhokha API credentials/documentation; this adapter deliberately refuses to
 * fabricate provider protocol details.
 */
export class IKhokhaPaymentAdapter implements PaymentAdapter {
  constructor(
    private readonly config: {
      apiBaseUrl: string;
      websiteKey: string;
      callbackSecret: string;
    },
  ) {}

  async createPayment(_intent: PaymentIntent): Promise<PaymentSession> {
    if (!this.config.apiBaseUrl || !this.config.websiteKey) {
      throw new Error("iKhokha payment configuration is incomplete");
    }

    throw new Error(
      "iKhokha API request mapping is pending verified merchant API documentation; no live payment request is fabricated.",
    );
  }

  verifyCallback(_callback: PaymentCallback): boolean {
    if (!this.config.callbackSecret) {
      return false;
    }

    // Do not accept client-supplied payment status. Provider-specific
    // signature canonicalisation must be configured from the official iKhokha
    // integration contract before production callbacks are enabled.
    return false;
  }
}
