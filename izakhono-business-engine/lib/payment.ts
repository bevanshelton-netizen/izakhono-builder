import { dbFetch } from '@/lib/server-db';

type Plan = 'START' | 'GROW' | 'PRO' | 'ENTERPRISE';

const MONTHLY_PRICE_ENV: Record<Plan, string> = {
  START: 'STRIPE_PRICE_START',
  GROW: 'STRIPE_PRICE_GROW',
  PRO: 'STRIPE_PRICE_PRO',
  ENTERPRISE: 'STRIPE_PRICE_ENTERPRISE',
};

const SETUP_PRICE_ENV: Record<Plan, string> = {
  START: 'STRIPE_SETUP_PRICE_START',
  GROW: 'STRIPE_SETUP_PRICE_GROW',
  PRO: 'STRIPE_SETUP_PRICE_PRO',
  ENTERPRISE: 'STRIPE_SETUP_PRICE_ENTERPRISE',
};

function stripeConfig(plan: Plan) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const monthlyPriceId = process.env[MONTHLY_PRICE_ENV[plan]];
  const setupPriceId = process.env[SETUP_PRICE_ENV[plan]];
  if (!secret) throw new Error('Stripe checkout is not configured: STRIPE_SECRET_KEY is missing.');
  if (!monthlyPriceId) throw new Error(`Stripe checkout is not configured: ${MONTHLY_PRICE_ENV[plan]} is missing.`);
  if (!setupPriceId) throw new Error(`Stripe checkout is not configured: ${SETUP_PRICE_ENV[plan]} is missing.`);
  return { secret, monthlyPriceId, setupPriceId };
}

function appUrl(request: Request) {
  const configured = process.env.BUSINESS_ENGINE_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  return new URL(request.url).origin;
}

async function stripePost(path: string, secret: string, body: URLSearchParams, idempotencyKey: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': idempotencyKey,
    },
    body,
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `Stripe request failed (${response.status}).`);
  return data;
}

export async function createBusinessEngineCheckout(request: Request, order: any) {
  const plan = String(order.plan || '').toUpperCase() as Plan;
  if (!(plan in MONTHLY_PRICE_ENV)) throw new Error(`Unsupported Business Engine plan: ${plan}.`);

  const { secret, monthlyPriceId, setupPriceId } = stripeConfig(plan);
  const base = appUrl(request);
  const existing = await dbFetch(
    `business_engine_payment_checkout?select=id,checkout_reference,checkout_url,status&commercial_order_id=eq.${encodeURIComponent(order.id)}&provider=eq.stripe&limit=1`,
  );
  const current = existing?.[0];
  if (current?.status === 'created' && current.checkout_url) {
    return { checkoutUrl: current.checkout_url, checkoutReference: current.checkout_reference };
  }

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', setupPriceId);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[1][price]', monthlyPriceId);
  params.set('line_items[1][quantity]', '1');
  params.set('customer_email', String(order.business_email));
  params.set('client_reference_id', String(order.id));
  params.set('success_url', `${base}/?payment=success&commercialOrderId=${encodeURIComponent(order.id)}`);
  params.set('cancel_url', `${base}/?payment=cancelled&commercialOrderId=${encodeURIComponent(order.id)}`);
  params.set('metadata[commercial_order_id]', String(order.id));
  params.set('metadata[plan]', plan);
  params.set('metadata[business_name]', String(order.business_name));
  params.set('subscription_data[metadata][commercial_order_id]', String(order.id));
  params.set('subscription_data[metadata][plan]', plan);

  const session = await stripePost('checkout/sessions', secret, params, `business-engine-checkout-${order.id}`);
  if (!session?.id || !session?.url) throw new Error('Stripe returned an incomplete Checkout Session.');

  await dbFetch('business_engine_payment_checkout', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      commercial_order_id: order.id,
      provider: 'stripe',
      checkout_reference: session.id,
      checkout_url: session.url,
      setup_amount_zar: order.setup_amount_zar,
      currency: 'ZAR',
      status: 'created',
      metadata: { plan, stripe_mode: 'subscription', setup_price: setupPriceId, monthly_price: monthlyPriceId },
    }),
  });

  return { checkoutUrl: session.url, checkoutReference: session.id };
}
