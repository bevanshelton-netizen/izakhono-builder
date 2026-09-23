import { moderateText } from '../../../lib/moderation';

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return Response.json({ error: 'Expected application/json' }, { status: 415 });
  }

  const payload = await request.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof payload?.text === 'string' ? payload.text.slice(0, 8000) : '';
  const decision = moderateText(text);

  return Response.json({ ok: true, decision });
}
