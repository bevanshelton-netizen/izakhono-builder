import { NextResponse } from 'next/server';
import { dbFetch } from '@/lib/server-db';

/**
 * Creates the application-side checkout handoff only. It deliberately does not
 * create or charge a live financial object. The verified gateway webhook remains
 * the sole authority for paid-order activation.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.commercialOrderId || '').trim();
    if (!orderId) return NextResponse.json({ ok: false, error: 'commercialOrderId is required.' }, { status: 400 });

    const orders = await dbFetch(`business_engine_commercial_orders?select=id,plan,business_name,business_email,setup_amount_zar,monthly_amount_zar,status,payment_provider&id=eq.${encodeURIComponent(orderId)}`);
    const order = orders?.[0];
    if (!order) return NextResponse.json({ ok: false, error: 'Commercial order not found.' }, { status: 404 });

    const provider = process.env.BUSINESS_ENGINE_PAYMENT_PROVIDER || 'stripe';
    const configured = provider === 'stripe' && Boolean(process.env.STRIPE_SECRET_KEY);

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
        provider,
        configured,
        liveChargeCreated: false,
        activationAuthority: 'verified_webhook',
        nextAction: configured ? 'provider_checkout_adapter' : 'configure_payment_provider',
      },
    });
  } catch (error) {
    console.error('Business Engine checkout handoff failed', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to prepare checkout.' }, { status: 500 });
  }
}
