import { decideProviderEvent } from './payment-lifecycle';

const intent = {
  bookingId: 'booking-1',
  amount: 2100,
  currency: 'ZAR',
  status: 'requires_provider' as const,
  provider: 'ikhokha' as const,
  providerReference: 'provider-1',
  idempotencyKey: 'rent-booking-1',
};

const baseEvent = {
  provider: 'ikhokha' as const,
  eventId: 'event-1',
  providerReference: 'provider-1',
  amount: 2100,
  currency: 'ZAR',
  status: 'paid' as const,
  rawEventHash: 'hash-1',
};

if (decideProviderEvent(intent, baseEvent, false).nextPaymentStatus !== 'paid') throw new Error('valid event rejected');
if (decideProviderEvent(intent, baseEvent, true).status !== 'duplicate') throw new Error('duplicate event not idempotent');
if (decideProviderEvent(intent, { ...baseEvent, amount: 1 }, false).status !== 'rejected') throw new Error('amount mismatch accepted');
if (decideProviderEvent(intent, { ...baseEvent, currency: 'USD' }, false).status !== 'rejected') throw new Error('currency mismatch accepted');

console.log('IZAKHONO RENT payment lifecycle tests passed');
