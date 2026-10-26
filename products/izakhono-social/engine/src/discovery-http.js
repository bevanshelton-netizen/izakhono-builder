import { createDiscoveryRecord, createEnquiry, decideVerification, discover, submitVerification } from './discovery.js';

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function discoveryHttp(req, res, { account = null, ownerAuthorized = false } = {}) {
  const url = new URL(req.url, 'http://connecta.local');

  if (req.method === 'GET' && url.pathname === '/v1/discovery') {
    const rows = await discover({
      kind: url.searchParams.get('kind') || '',
      category: url.searchParams.get('category') || '',
      q: url.searchParams.get('q') || '',
      limit: url.searchParams.get('limit') || 30,
    });
    return send(res, 200, { ok: true, records: rows, trust: 'ACTIVE_ONLY' });
  }

  if (req.method === 'POST' && url.pathname === '/v1/discovery') {
    if (!account && !ownerAuthorized) return send(res, 401, { ok: false, error: 'Authentication required' });
    const body = await readJson(req);
    const record = await createDiscoveryRecord(body, account?.id || null);
    return send(res, 201, { ok: true, record });
  }

  const verifyMatch = url.pathname.match(/^\/v1\/discovery\/([0-9a-f-]+)\/verify$/i);
  if (req.method === 'POST' && verifyMatch) {
    if (!ownerAuthorized) return send(res, 401, { ok: false, error: 'Owner authorization required' });
    const body = await readJson(req);
    const result = await submitVerification(verifyMatch[1], body.evidenceType, body.evidenceReference);
    if (!result) return send(res, 404, { ok: false, error: 'Discovery record not found or already decided' });
    return send(res, 202, { ok: true, ...result });
  }

  const decideMatch = url.pathname.match(/^\/v1\/discovery\/([0-9a-f-]+)\/decision$/i);
  if (req.method === 'POST' && decideMatch) {
    if (!ownerAuthorized) return send(res, 401, { ok: false, error: 'Owner authorization required' });
    const body = await readJson(req);
    const record = await decideVerification(decideMatch[1], body.decision, body.reviewerSubject || 'owner', body.notes || '');
    if (!record) return send(res, 404, { ok: false, error: 'Pending verification evidence not found' });
    return send(res, 200, { ok: true, record });
  }

  const enquiryMatch = url.pathname.match(/^\/v1\/discovery\/([0-9a-f-]+)\/enquiries$/i);
  if (req.method === 'POST' && enquiryMatch) {
    if (!account) return send(res, 401, { ok: false, error: 'Authentication required' });
    const body = await readJson(req);
    const enquiry = await createEnquiry(
      enquiryMatch[1],
      account.id,
      body.message || '',
      body.consentToContact === true,
      body.campaignId || null,
    );
    if (!enquiry) return send(res, 404, { ok: false, error: 'Active discovery record not found' });
    return send(res, 201, { ok: true, enquiry, commercialState: 'ENQUIRY_NOT_SALE' });
  }

  return false;
}
