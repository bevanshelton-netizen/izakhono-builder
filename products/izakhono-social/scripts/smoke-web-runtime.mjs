const base = process.env.CONNECTA_WEB_URL || 'http://127.0.0.1:3080';

async function request(path, { method='GET', cookie, body, expect } = {}) {
  const headers = { accept: 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const data = await response.json().catch(() => null);
  if (expect !== undefined ? response.status !== expect : !response.ok) {
    throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  }
  return { response, data };
}

const health = await request('/health');
if (!health.data?.ok || health.data?.engine !== 'ok' || health.data?.behaviouralTracking !== false) {
  throw new Error('CONNECTA web health did not prove engine/database readiness');
}

const suffix = Date.now().toString(36);
const email = `web-${suffix}@connecta.local`;
const handle = `web-${suffix}`;
const registration = await request('/api/connecta/v1/auth/register', {
  method: 'POST',
  body: {
    email,
    handle,
    displayName: 'CONNECTA Web Runtime',
    password: 'Connecta-Web-Runtime-Passphrase-51',
  },
});

if ('token' in (registration.data || {})) {
  throw new Error('Engine session token leaked into browser JSON response');
}
const setCookie = registration.response.headers.get('set-cookie') || '';
const cookie = setCookie.split(';')[0];
if (!cookie.startsWith('connecta_session=')) {
  throw new Error('Secure CONNECTA session cookie was not issued');
}

const me = await request('/api/connecta/v1/me', { cookie });
if (me.data?.account?.handle !== handle) throw new Error('Authenticated /me proxy failed');

const communityName = `Web Runtime ${suffix}`;
const community = await request('/api/connecta/v1/communities', {
  method: 'POST',
  cookie,
  body: {
    name: communityName,
    slug: `web-runtime-${suffix}`,
    description: 'CONNECTA public-readiness smoke community.',
    visibility: 'public',
  },
});
if (!community.data?.community?.id) throw new Error('Community creation through web proxy failed');

const postText = `CONNECTA runtime post ${suffix}`;
const post = await request('/api/connecta/v1/posts', {
  method: 'POST',
  cookie,
  body: { body: postText, visibility: 'public' },
});
if (!post.data?.post?.id) throw new Error('Post creation through web proxy failed');

const feed = await request('/api/connecta/v1/feed?mode=balanced&limit=50', { cookie });
if (!Array.isArray(feed.data?.posts) || !feed.data.posts.some((item) => item.body === postText)) {
  throw new Error('Persisted post did not appear through web feed proxy');
}

const notifications = await request('/api/connecta/v1/notifications', { cookie });
if (!Array.isArray(notifications.data?.notifications)) {
  throw new Error('Notifications route failed through web proxy');
}

const logout = await request('/api/connecta/v1/auth/logout', { method: 'POST', cookie });
if (!logout.data?.ok) throw new Error('Logout through web proxy failed');
const cleared = logout.response.headers.get('set-cookie') || '';
if (!cleared.includes('connecta_session=') || !/Max-Age=0/i.test(cleared)) {
  throw new Error('Logout did not clear the CONNECTA session cookie');
}

console.log(JSON.stringify({
  ok: true,
  health: true,
  httpOnlySessionProxy: true,
  tokenLeak: false,
  communityPersisted: true,
  postPersisted: true,
  notifications: true,
  logoutClearsCookie: true,
}));
