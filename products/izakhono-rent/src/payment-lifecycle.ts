export type PaymentIntentStatus =
  | 'created'
  | 'requires_provider'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export type ProviderEventStatus = 'accepted' | 'duplicate' | 'rejected';

export interface PaymentIntent {
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  provider: 'ikhokha';
  providerReference?: string;
  idempotencyKey: string;
}

export interface ProviderPaymentEvent {
  provider: 'ikhokha';
  eventId: string;
  providerReference: string;
  amount: number;
  currency: string;
  status: 'authorized' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  rawEventHash: string;
}

export interface EventDecision {
  status: ProviderEventStatus;
  nextPaymentStatus?: PaymentIntentStatus;
  reason?: string;
}

/**
 * Provider events are accepted only when their amount/currency match the
 * server-created intent. Duplicate provider event IDs are harmless.
 */
export function decideProviderEvent(
  intent: PaymentIntent,
  event: ProviderPaymentEvent,
  alreadyProcessed: boolean,
): EventDecision {
  if (alreadyProcessed) return { status: 'duplicate', reason: 'provider event already processed' };
  if (event.provider !== intent.provider) return { status: 'rejected', reason: 'provider mismatch' };
  if (event.providerReference !== (intent.providerReference ?? event.providerReference)) {
    return { status: 'rejected', reason: 'provider reference mismatch' };
  }
  if (Math.round(event.amount * 100) !== Math.round(intent.amount * 100)) {
    return { status: 'rejected', reason: 'amount mismatch' };
  }
  if (event.currency.toUpperCase() !== intent.currency.toUpperCase()) {
    return { status: 'rejected', reason: 'currency mismatch' };
  }

  return {
    status: 'accepted',
    nextPaymentStatus: event.status,
  };
}
