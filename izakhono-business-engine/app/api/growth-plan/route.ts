import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const business = String(body.business ?? 'Your business');
  const goal = String(body.goal ?? 'Generate more qualified customers');
  const budget = Number(body.budget ?? 5000);

  const plan = {
    id: `plan_${Date.now()}`,
    business,
    goal,
    budget,
    status: 'ready',
    createdAt: new Date().toISOString(),
    actions: [
      { channel: 'Website & Conversion', priority: 'high', action: 'Create a conversion-focused landing page and lead form.' },
      { channel: 'SEO Engine', priority: 'high', action: 'Publish a local-intent content cluster around the highest-value customer searches.' },
      { channel: 'Paid Growth', priority: 'high', action: `Allocate an initial paid-media test budget of R${Math.round(budget * 0.6).toLocaleString()}.` },
      { channel: 'Social Command', priority: 'medium', action: 'Create a 30-day content and engagement calendar.' },
      { channel: 'CRM & WhatsApp', priority: 'high', action: 'Capture, qualify and route every new lead into the follow-up pipeline.' },
      { channel: 'AI Operations', priority: 'medium', action: 'Run daily performance checks and surface recommended growth actions.' }
    ]
  };

  return NextResponse.json(plan);
}
