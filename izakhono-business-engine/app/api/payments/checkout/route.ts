import { NextResponse } from 'next/server';
import { dbFetch } from '@/lib/server-db';
import { createBusinessEngineCheckout } from '@/lib/payment';

/**
 * Creates a provider checkout only when the required Stripe configuration exists.
 * Browser redirects never activate an order; verified gateway webhooks remain the
 * sole authority for paid-order activation.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.commercialOrderId || '').trim();
    if (!orderId) return NextResponse.json({ ok: false, error: 'commercialOrderId is required.' }, { status: 400 });

    const orders = await dbFetch(`business_engine_commercial_orders?select=id,plan,business_name,business_email,setup_amount_zar,monthly_amount_zar,status,payment_provider&id=eq.${encodeURIComponent(orderId)}`);
    const order = orders?.[0];
    if (!order) return NextResponse.json({ ok: false, error: 'Commercial order not found.' }, { status: 404 });
    if (!['payment_pending', 'paid', 'provisioning', 'active'].includes(String(order.status))) {
      return NextResponse.json({ ok: false, error: `Order cannot enter checkout from status ${order.status}.` }, { status: 409 });
    }
    if (['paid', 'provisioning', 'active'].includes(String(order.status))) {
      return NextResponse.json({
        ok: true,
        order: { id: order.id, status: order.status },
        payment: { activationAuthority: 'verified_webhook', checkoutAlreadyCompleted: true },
      });
    }

    const provider = process.env.BUSINESS_ENGINE_PAYMENT_PROVIDER || 'stripe';
    if (provider !== 'stripe') {
      return NextResponse.json({ ok: false, error: `Payment provider '${provider}' is not implemented.` }, { status: 503 });
    }

    const checkout = await createBusinessEngineCheckout(request, order);
    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        plan: order.plan,
        businessName: order.business_name,
        businessEmail: order.business_email,
        setupAmountZar: order.setup_amount_zar,
        monthlyAmountZar: order.monthly_amount_zar,
        status: order.status,
      },
      payment: {
        provider: 'stripe',
        configured: true,
        checkoutUrl: checkout.checkoutUrl,
        checkoutReference: checkout.checkoutReference,
        liveChargeCreated: false,
        activationAuthority: 'verified_webhook',
      },
    });
  } catch (error) {
    console.error('Business Engine checkout failed', error);
    const message = error instanceof Error ? error.message : 'Unable to create secure checkout.';
    const status = /not configured|missing/i.test(message) ? 503 : 500;
    return NextResponse.json({ ok: false, error: message, activationAuthority: 'verified_webhook' }, { status });
  }
}
