import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { dbFetch } from '@/lib/server-db';

function verifySignature(rawBody: string, signature: string, secret: string) {
  const parts = signature.split(',');
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const candidates = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || candidates.length === 0) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return candidates.some((candidate) => {
    const a = Buffer.from(expected);
    const b = Buffer.from(candidate);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: 'Webhook is not configured.' }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') || '';
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ ok: false, error: 'Invalid webhook signature.' }, { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody);
    const object = event?.data?.object || {};
    const commercialOrderId = object?.metadata?.commercial_order_id || object?.client_reference_id || null;
    const providerReference = object?.payment_intent || object?.subscription || object?.id || null;

    const recorded = await dbFetch('rpc/record_business_engine_payment_event', {
      method: 'POST',
      body: JSON.stringify({
        p_provider: 'stripe',
        p_event_id: String(event.id || ''),
        p_event_type: String(event.type || ''),
        p_commercial_order_id: commercialOrderId,
        p_provider_reference: providerReference,
        p_payload: event,
      }),
    });

    const row = Array.isArray(recorded) ? recorded[0] : recorded;
    const eventId = row?.id || row?.event_id || row;
    const activatable = new Set(['checkout.session.completed', 'payment_intent.succeeded', 'invoice.paid']);

    if (eventId && activatable.has(event.type)) {
      await dbFetch('rpc/activate_business_engine_payment_event', {
        method: 'POST',
        body: JSON.stringify({ p_event_id: eventId }),
      });
    }

    return NextResponse.json({ ok: true, received: true });
  } catch (error) {
    console.error('Business Engine Stripe webhook failed', error);
    return NextResponse.json({ ok: false, error: 'Webhook processing failed.' }, { status: 500 });
  }
}
