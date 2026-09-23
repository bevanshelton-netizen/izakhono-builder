import sharp from 'sharp';

const base = process.env.CONNECTA_ENGINE_URL || 'http://127.0.0.1:4100';

async function api(path, { method='GET', token, body, expect } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (expect !== undefined ? response.status !== expect : !response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function upload(path, token, bytes) {
  const response = await fetch(base + path, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
    body: bytes,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`PUT ${path} failed: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

const suffix = Date.now().toString(36);
const owner = await api('/v1/auth/register', {
  method:'POST',
  body:{
    email:`owner-${suffix}@connecta.local`,
    handle:`owner-${suffix}`,
    displayName:'Original Owner',
    password:'Connecta-Test-Passphrase-21',
  },
});
const sharer = await api('/v1/auth/register', {
  method:'POST',
  body:{
    email:`sharer-${suffix}@connecta.local`,
    handle:`sharer-${suffix}`,
    displayName:'Content Sharer',
    password:'Connecta-Test-Passphrase-22',
  },
});

const post = await api('/v1/posts', {
  method:'POST',
  token:owner.token,
  body:{body:'Original public post for share alert testing.',visibility:'public'},
});
const share = await api('/v1/shares', {
  method:'POST',
  token:sharer.token,
  body:{sourceType:'post',sourceId:post.post.id,commentary:'Shared with original attribution.'},
});
if (!share.ownerAlerted) throw new Error('Owner alert flag missing');

let notices = (await api('/v1/notifications',{token:owner.token})).notifications;
if (!notices.some((n) => n.kind === 'content_shared' && n.target_id === post.post.id)) {
  throw new Error('Share notification missing');
}

const first = await api('/v1/media', {
  method:'POST',
  token:owner.token,
  body:{mediaType:'image',mimeType:'image/png'},
});
const bytes = await sharp({
  create: {
    width: 64,
    height: 64,
    channels: 3,
    background: { r: 40, g: 120, b: 200 },
  },
}).composite([
  { input: Buffer.from('<svg width="64" height="64"><rect x="8" y="8" width="18" height="40" fill="white"/><circle cx="43" cy="32" r="12" fill="black"/></svg>') }
]).png().toBuffer();
await upload(`/v1/media/${first.media.id}/content`, owner.token, bytes);

const second = await api('/v1/media', {
  method:'POST',
  token:sharer.token,
  body:{mediaType:'image',mimeType:'image/png'},
});
const duplicate = await upload(`/v1/media/${second.media.id}/content`, sharer.token, bytes);
if (!duplicate.duplicateOwnerAlert) throw new Error('Duplicate media did not alert original owner');

notices = (await api('/v1/notifications',{token:owner.token})).notifications;
if (!notices.some((n) => n.kind === 'content_duplicate_detected')) {
  throw new Error('Duplicate media notification missing');
}

console.log(JSON.stringify({ok:true,shareOwnerAlert:true,duplicateMediaOwnerAlert:true}));
