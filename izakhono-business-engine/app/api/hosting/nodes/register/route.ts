import { NextResponse } from 'next/server';
import { dbFetch } from '../../../../lib/server-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nodeKey = String(body.node_key || '');
    const endpoint = String(body.endpoint || '');
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

    if (!nodeKey || !endpoint) return NextResponse.json({ ok: false, error: 'NODE_KEY_ENDPOINT_REQUIRED' }, { status: 400 });
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return NextResponse.json({ ok: false, error: 'NODE_ENDPOINT_MUST_USE_HTTPS' }, { status: 400 });

    const result = await dbFetch('rpc/register_izakhono_hosting_node', {
      method: 'POST',
      body: JSON.stringify({ p_node_key: nodeKey, p_endpoint: endpoint.replace(/\/$/, ''), p_metadata: metadata }),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'NODE_REGISTRATION_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: 409 });
  }
}
