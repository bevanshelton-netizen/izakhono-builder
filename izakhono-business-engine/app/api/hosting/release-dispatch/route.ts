import { NextResponse } from 'next/server';
import { dbFetch } from '../../../../lib/server-db';

function safeUrl(value: unknown) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:') throw new Error('NODE_ENDPOINT_MUST_USE_HTTPS');
  return url;
}

export async function POST() {
  try {
    const claimed = await dbFetch('rpc/dispatch_next_app_store_release', { method: 'POST' });
    const row = Array.isArray(claimed) ? claimed[0] : claimed;
    if (!row || row.status !== 'DISPATCH_READY') return NextResponse.json(row || { ok: true, status: 'IDLE' });

    const target = row.target || {};
    const endpoint = safeUrl(target.endpoint);
    const release = await dbFetch(`app_store_release_queue?id=eq.${encodeURIComponent(row.queue_id)}&limit=1`);
    const releaseRow = Array.isArray(release) ? release[0] : null;
    if (!releaseRow?.artifact_id) throw new Error('RELEASE_ARTIFACT_REQUIRED');

    const artifacts = await dbFetch(`app_build_artifacts?id=eq.${encodeURIComponent(releaseRow.artifact_id)}&limit=1`);
    const artifact = Array.isArray(artifacts) ? artifacts[0] : null;
    if (!artifact?.artifact_url || !artifact?.checksum || !artifact?.version) throw new Error('VERIFIED_ARTIFACT_REQUIRED');

    const nodeKey = String(target.node_key || process.env.IZAKHONO_NODE_DISPATCH_KEY || '');
    if (!nodeKey) throw new Error('NODE_DISPATCH_CREDENTIAL_REQUIRED');

    const response = await fetch(`${endpoint.toString().replace(/\/$/, '')}/v1/releases`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${nodeKey}` },
      body: JSON.stringify({
        release_queue_id: row.queue_id,
        job_id: row.job_id,
        artifact_id: row.artifact_id,
        artifact_url: artifact.artifact_url,
        checksum: artifact.checksum,
        version: artifact.version,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `NODE_DISPATCH_HTTP_${response.status}`);

    await dbFetch(`app_store_release_queue?id=eq.${encodeURIComponent(row.queue_id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'CLAIMED', execution_status: 'running', provider_request_id: body.provider_request_id, result: body, error_message: null, updated_at: new Date().toISOString() }),
    });

    return NextResponse.json({ ok: true, status: 'DISPATCHED', queue_id: row.queue_id, node_id: target.node_id, provider_request_id: body.provider_request_id, node_response: body });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'RELEASE_DISPATCH_FAILED' }, { status: 502 });
  }
}
