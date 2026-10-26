import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const required = ['businessName', 'email'];
  const missing = required.filter((key) => !String(body[key] ?? '').trim());
  if (missing.length) {
    return NextResponse.json({ error: `Missing: ${missing.join(', ')}` }, { status: 400 });
  }

  return NextResponse.json({
    id: `biz_${Date.now()}`,
    status: 'onboarding',
    businessName: String(body.businessName),
    email: String(body.email),
    website: String(body.website ?? ''),
    goal: String(body.goal ?? 'Generate more qualified customers'),
    next: ['Provision workspace', 'Connect domain', 'Configure CRM', 'Activate growth plan']
  }, { status: 201 });
}
