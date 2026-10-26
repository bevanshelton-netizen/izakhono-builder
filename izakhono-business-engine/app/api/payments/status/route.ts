import { NextResponse } from 'next/server';
import { dbFetch } from '@/lib/server-db';

export async function GET(request: Request) {
  try {
    const orderId = new URL(request.url).searchParams.get('commercialOrderId')?.trim();
    if (!orderId) return NextResponse.json({ ok: false, error: 'commercialOrderId is required.' }, { status: 400 });

    const orders = await dbFetch(`business_engine_commercial_orders?select=id,plan,status,payment_provider,payment_reference,workspace_id,created_at,updated_at&id=eq.${encodeURIComponent(orderId)}&limit=1`);
    const order = orders?.[0];
    if (!order) return NextResponse.json({ ok: false, error: 'Commercial order not found.' }, { status: 404 });

    const checkouts = await dbFetch(`business_engine_payment_checkout?select=id,provider,checkout_reference,checkout_url,status,currency,created_at,updated_at&commercial_order_id=eq.${encodeURIComponent(orderId)}&order=created_at.desc&limit=1`);
    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        plan: order.plan,
        status: order.status,
        workspaceId: order.workspace_id,
        paymentProvider: order.payment_provider,
        paymentReference: order.payment_reference,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
      checkout: checkouts?.[0] || null,
      paymentActivationAuthority: 'verified_gateway_event',
    });
  } catch (error) {
    console.error('Business Engine payment status failed', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to read payment status.' }, { status: 500 });
  }
}
