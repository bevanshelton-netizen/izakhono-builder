import { processAuthenticatedWebhook, unconfiguredIKhokhaWebhookAuthenticator } from './webhook-ingress';
import { PaymentIntent, ProviderPaymentEvent } from './payment-lifecycle';

const intent: PaymentIntent = {
  bookingId: 'booking-1',
  amount: 1100,
  currency: 'ZAR',
  status: 'requires_provider',
  provider: 'ikhokha',
  providerReference: 'ref-1',
  idempotencyKey: 'idem-1',
};

const event: ProviderPaymentEvent = {
  provider: 'ikhokha',
  eventId: 'evt-1',
  providerReference: 'ref-1',
  amount: 1100,
  currency: 'ZAR',
  status: 'paid',
  rawEventHash: 'hash-1',
};

const configured = { authenticate: () => ({ event, rawEventHash: event.rawEventHash }) };
const accepted = processAuthenticatedWebhook('{}', {}, intent, configured, false);
if (!accepted.accepted || accepted.httpStatus !== 200) throw new Error('authenticated event should be accepted');

const duplicate = processAuthenticatedWebhook('{}', {}, intent, configured, true);
if (!duplicate.accepted || !duplicate.duplicate) throw new Error('duplicate event should be idempotent');

const blocked = processAuthenticatedWebhook('{}', {}, intent, unconfiguredIKhokhaWebhookAuthenticator, false);
if (blocked.accepted || blocked.httpStatus !== 401) throw new Error('unconfigured provider adapter must fail closed');

console.log('IZAKHONO RENT webhook ingress tests passed');
