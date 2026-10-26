import { NextResponse } from 'next/server';
import { dbFetch } from '@/lib/server-db';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await dbFetch('rpc/create_business_engine_onboarding', {
      method: 'POST',
      body: JSON.stringify({
        p_business_name: String(body?.businessName || '').trim(),
        p_business_email: String(body?.email || '').trim().toLowerCase(),
        p_plan: String(body?.plan || 'START').toUpperCase(),
        p_domain: body?.domain ? String(body.domain).trim().toLowerCase() : null,
        p_owner_user_id: body?.ownerUserId ? String(body.ownerUserId) : null,
        p_monthly_ad_budget_cents: body?.monthlyAdBudgetCents == null ? null : Number(body.monthlyAdBudgetCents),
      }),
    });

    const row = Array.isArray(result) ? result[0] : result;
    return NextResponse.json({ ok: true, ...row });
  } catch (error) {
    console.error('Business Engine commercial onboarding failed', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to create onboarding.' }, { status: 400 });
  }
}
