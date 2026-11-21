import { calculateQuote } from './quote';
import { transitionBooking, BookingState } from './booking';
import { decideProviderEvent } from './payment-lifecycle';
import { processAuthenticatedWebhook, ProviderWebhookAuthenticator } from './webhook-ingress';
import { validateListing, canPublishListing } from './listing';

const quote = calculateQuote({
  rentalPeriod: 'day',
  rentalPrice: 1000,
  startsAt: '2026-11-01T09:00:00Z',
  endsAt: '2026-11-03T09:00:00Z',
  serviceFeeBps: 1000,
  depositAmount: 500,
});
if (quote.totalAmount !== 2700) throw new Error('quote contract failed');

const listing = validateListing({
  title: 'Verified vehicle', description: 'A verified rental vehicle.', category: 'Vehicles', location: 'Johannesburg', rentalPrice: 1000, currency: 'ZAR',
});
if (!listing.valid || !canPublishListing(listing, true, 'verified')) throw new Error('listing contract failed');

let booking: BookingState = { status: 'pending', paymentStatus: 'pending' };
booking = transitionBooking(booking, 'payment_authorized');
booking = transitionBooking(booking, 'payment_paid');
if (booking.status !== 'confirmed' || booking.paymentStatus !== 'paid') throw new Error('payment confirmation failed');

const intent = { bookingId: 'booking-1', amount: quote.totalAmount, currency: 'ZAR', status: 'requires_provider' as const, provider: 'ikhokha' as const, providerReference: 'provider-1', idempotencyKey: 'idem-1' };
const event = { provider: 'ikhokha' as const, eventId: 'event-1', providerReference: 'provider-1', amount: quote.totalAmount, currency: 'ZAR', status: 'paid' as const, rawEventHash: 'hash' };
const decision = decideProviderEvent(intent, event, false);
if (decision.status !== 'accepted' || decision.nextPaymentStatus !== 'paid') throw new Error('provider event contract failed');

const authenticator: ProviderWebhookAuthenticator = { authenticate: () => ({ event, rawEventHash: 'hash' }) };
const webhook = processAuthenticatedWebhook('{}', {}, intent, authenticator, false);
if (!webhook.accepted) throw new Error('webhook contract failed');

booking = transitionBooking(booking, 'pickup');
booking = transitionBooking(booking, 'return');
booking = transitionBooking(booking, 'inspection_complete');
if (booking.status !== 'completed') throw new Error('handover completion failed');

let disputed: BookingState = { status: 'active', paymentStatus: 'paid' };
disputed = transitionBooking(disputed, 'dispute_opened');
if (disputed.status !== 'disputed') throw new Error('dispute contract failed');

console.log('IZAKHONO RENT end-to-end transaction contract passed');
