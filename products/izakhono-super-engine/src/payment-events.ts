export type PaymentEventKind = 'webhook.received' | 'payment.paid' | 'payment.failed' | 'payment.cancelled' | 'payment.refunded' | 'refund.requested' | 'receipt.issued';

export interface PaymentEvent {
  id: string;
  kind: PaymentEventKind;
  paymentIntentId: string;
  externalTransactionId: string;
  provider: string;
  fingerprint: string;
  createdAt: string;
}

export interface PaymentEventStore {
  record(event: PaymentEvent): Promise<boolean>;
  hasFingerprint(fingerprint: string): Promise<boolean>;
}

export class MemoryPaymentEventStore implements PaymentEventStore {
  private readonly fingerprints = new Set<string>();
  private readonly events = new Map<string, PaymentEvent>();

  async record(event: PaymentEvent): Promise<boolean> {
    if (this.fingerprints.has(event.fingerprint)) return false;
    this.fingerprints.add(event.fingerprint);
    this.events.set(event.id, { ...event });
    return true;
  }

  async hasFingerprint(fingerprint: string): Promise<boolean> {
    return this.fingerprints.has(fingerprint);
  }
}

/**
 * Storage contract for production Postgres/Supabase adapters. The unique fingerprint
 * constraint must be enforced by the database so concurrent webhook deliveries cannot
 * create duplicate financial events.
 */
export interface DurablePaymentEventRecord extends PaymentEvent {
  recordedAt: string;
}

export function createPaymentEvent(input: {
  kind: PaymentEventKind;
  paymentIntentId: string;
  externalTransactionId: string;
  provider: string;
  fingerprint: string;
}): PaymentEvent {
  if (!input.fingerprint.trim()) throw new Error('Payment event fingerprint is required');
  return {
    id: `pevt_${crypto.randomUUID()}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
}
