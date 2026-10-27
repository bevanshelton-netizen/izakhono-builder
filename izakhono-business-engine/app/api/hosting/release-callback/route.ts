import { NextResponse } from 'next/server';
import { dbFetch } from '../../../../lib/server-db';

export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const nodeKey = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!nodeKey) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const body = await request.json();
    const releaseQueueId = String(body.release_queue_id || '');
    const providerRequestId = String(body.provider_request_id || '');
    const publishedUrl = String(body.published_url || '');
    const handoverUrl = body.handover_url ? String(body.handover_url) : null;
    if (!releaseQueueId || !providerRequestId || !publishedUrl) {
      return NextResponse.json({ ok: false, error: 'RELEASE_QUEUE_ID_PROVIDER_REQUEST_ID_PUBLISHED_URL_REQUIRED' }, { status: 400 });
    }

    const result = await dbFetch('rpc/complete_app_store_release_from_node', {
      method: 'POST',
      body: JSON.stringify({
        p_node_key: nodeKey,
        p_release_queue_id: releaseQueueId,
        p_provider_request_id: providerRequestId,
        p_published_url: publishedUrl,
        p_handover_url: handoverUrl,
        p_result: {
          version: body.version ?? null,
          checksum: body.checksum ?? null,
          health_url: body.health_url ?? null,
          execution_status: body.execution_status ?? null,
        },
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RELEASE_CALLBACK_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: 409 });
  }
}
