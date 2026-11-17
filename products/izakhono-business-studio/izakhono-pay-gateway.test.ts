import { strict as assert } from 'node:assert';
import { createIzakhonoPayGateway } from './izakhono-pay-gateway';
import type { PaymentVerificationRequest } from './order-provisioning-orchestrator';

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const paidIntent = {
  id: 'pi_100',
  reference: 'IZP-100',
  app_slug: 'business-studio',
  merchant_reference: 'ORD-100',
  amount_minor: 14900,
  currency: 'ZAR',
  status: 'paid',
  routed_provider: 'ikhokha',
  provider_reference: 'PAYLINK-100',
  paid_at: '2026-11-17T12:00:00.000Z'
};

test('creates an order-bound payment intent using server-only merchant authentication', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const gateway = createIzakhonoPayGateway({
    baseUrl: 'https://pay.example.test',
    merchantSlug: 'business-studio',
    apiKey: 'server-only-test-key',
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestUrl = String(input);
      requestInit = init;
      return response({
        ok: true,
        intent: {
          ...paidIntent,
          status: 'requires_action',
          checkout_url: 'https://checkout.example.test/session',
          checkout_method: 'redirect'
        }
      });
    }) as typeof fetch
  });

  const checkout = await gateway.createOrderPaymentIntent({
    orderId: 'ORD-100',
    amountMinor: 14900,
    currency: 'ZAR',
    email: 'customer@example.test',
    idempotencyKey: 'order-ORD-100',
    returnUrl: 'https://studio.example.test/payment/return',
    cancelUrl: 'https://studio.example.test/payment/cancel'
  });

  assert.equal(requestUrl, 'https://pay.example.test/api/v1/intents');
  const headers = new Headers(requestInit?.headers);
  assert.equal(headers.get('x-izakhono-app'), 'business-studio');
  assert.equal(headers.get('x-izakhono-key'), 'server-only-test-key');
  assert.equal(headers.get('idempotency-key'), 'order-ORD-100');
  const payload = JSON.parse(String(requestInit?.body));
  assert.equal(payload.metadata.order_id, 'ORD-100');
  assert.equal(checkout.intentId, 'pi_100');
  assert.equal(checkout.checkoutUrl, 'https://checkout.example.test/session');
});

test('verifies paid state and exact merchant, order, amount, currency and provider reference server-side', async () => {
  const gateway = createIzakhonoPayGateway({
    baseUrl: 'https://pay.example.test',
    merchantSlug: 'business-studio',
    apiKey: 'server-only-test-key',
    now: () => '2026-11-17T12:00:01.000Z',
    fetchImpl: (async () => response({ ok: true, intent: paidIntent })) as typeof fetch
  });
  const request: PaymentVerificationRequest = {
    orderId: 'ORD-100',
    merchantSlug: 'business-studio',
    intentId: 'pi_100',
    amountMinor: 14900,
    currency: 'ZAR'
  };
  const receipt = await gateway.verifyPayment(request);
  assert.equal(receipt?.status, 'paid');
  assert.equal(receipt?.providerTransactionId, 'PAYLINK-100');
  assert.equal(receipt?.verificationSource, 'IZAKHONO_PAY_SERVER');
});

test('rejects a paid intent with a different order or amount', async () => {
  const gateway = createIzakhonoPayGateway({
    baseUrl: 'https://pay.example.test',
    merchantSlug: 'business-studio',
    apiKey: 'server-only-test-key',
    fetchImpl: (async () => response({ ok: true, intent: { ...paidIntent, merchant_reference: 'ORD-OTHER' } })) as typeof fetch
  });
  const request: PaymentVerificationRequest = {
    orderId: 'ORD-100',
    merchantSlug: 'business-studio',
    intentId: 'pi_100',
    amountMinor: 14900,
    currency: 'ZAR'
  };
  assert.equal(await gateway.verifyPayment(request), null);
});

test('rejects non-HTTPS payment service endpoints', () => {
  assert.throws(() => createIzakhonoPayGateway({
    baseUrl: 'http://pay.example.test',
    merchantSlug: 'business-studio',
    apiKey: 'server-only-test-key'
  }), /MUST_USE_HTTPS/);
});

console.log('izakhono-pay-gateway: PASS');
