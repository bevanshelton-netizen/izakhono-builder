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

function cookieFrom(result) {
  if ('token' in (result.data || {})) throw new Error('Engine session token leaked into browser JSON response');
  const setCookie = result.response.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  if (!cookie.startsWith('connecta_session=')) throw new Error('Secure CONNECTA session cookie was not issued');
  return cookie;
}

async function register(label, suffix) {
  const email = `${label}-${suffix}@connecta.local`;
  const handle = `${label}-${suffix}`;
  const registration = await request('/api/connecta/v1/auth/register', {
    method: 'POST',
    body: {
      email,
      handle,
      displayName: label === 'alpha' ? 'CONNECTA Alpha' : 'CONNECTA Beta',
      password: 'Connecta-Web-Runtime-Passphrase-51',
    },
  });
  const cookie = cookieFrom(registration);
  const me = await request('/api/connecta/v1/me', { cookie });
  if (me.data?.account?.handle !== handle || !me.data?.account?.id) throw new Error('Authenticated /me proxy failed');
  return { cookie, account: me.data.account, handle };
}

const health = await request('/health');
if (!health.data?.ok || health.data?.engine !== 'ok' || health.data?.behaviouralTracking !== false) {
  throw new Error('CONNECTA web health did not prove engine/database readiness');
}

const suffix = Date.now().toString(36);
const alpha = await register('alpha', suffix);
const beta = await register('beta', suffix);

const profilePatch = await request('/api/connecta/v1/profile', {
  method: 'PATCH',
  cookie: alpha.cookie,
  body: {
    displayName: 'CONNECTA Alpha Updated',
    bio: 'Public conversation runtime test.',
    location: 'Johannesburg',
    website: 'https://izakhonoafrica.co.za',
  },
});
if (profilePatch.data?.profile?.location !== 'Johannesburg') throw new Error('Profile PATCH failed through secure proxy');

const communityName = `Web Runtime ${suffix}`;
const community = await request('/api/connecta/v1/communities', {
  method: 'POST',
  cookie: alpha.cookie,
  body: {
    name: communityName,
    slug: `web-runtime-${suffix}`,
    description: 'CONNECTA public-readiness smoke community.',
    visibility: 'public',
  },
});
if (!community.data?.community?.id) throw new Error('Community creation through web proxy failed');

const follow = await request(`/api/connecta/v1/follows/${beta.account.id}/toggle`, {
  method: 'POST',
  cookie: alpha.cookie,
});
if (follow.data?.following !== true) throw new Error('Follow toggle did not follow target account');

const tag = `#RuntimeX${suffix.replace(/[^a-z0-9]/gi, '')}`;
const postText = `CONNECTA X-class runtime post ${suffix} ${tag}`;
const post = await request('/api/connecta/v1/posts', {
  method: 'POST',
  cookie: beta.cookie,
  body: { body: postText, visibility: 'public' },
});
const postId = post.data?.post?.id;
if (!postId) throw new Error('Post creation through web proxy failed');

const followingFeed = await request('/api/connecta/v1/feed?mode=following&limit=50', { cookie: alpha.cookie });
if (!Array.isArray(followingFeed.data?.posts) || !followingFeed.data.posts.some((item) => item.id === postId)) {
  throw new Error('Followed account post did not appear in following feed');
}

const reaction = await request(`/api/connecta/v1/posts/${postId}/reaction-toggle`, {
  method: 'POST',
  cookie: alpha.cookie,
  body: { kind: 'appreciate' },
});
if (reaction.data?.reacted !== true) throw new Error('Reaction toggle failed');

const bookmark = await request(`/api/connecta/v1/posts/${postId}/bookmark-toggle`, {
  method: 'POST',
  cookie: alpha.cookie,
});
if (bookmark.data?.bookmarked !== true) throw new Error('Bookmark toggle failed');

const repost = await request(`/api/connecta/v1/posts/${postId}/repost-toggle`, {
  method: 'POST',
  cookie: alpha.cookie,
});
if (repost.data?.reposted !== true) throw new Error('Repost toggle failed');

const replyText = `Runtime reply ${suffix}`;
const reply = await request(`/api/connecta/v1/posts/${postId}/comments`, {
  method: 'POST',
  cookie: alpha.cookie,
  body: { body: replyText },
});
if (!reply.data?.comment?.id) throw new Error('Reply creation failed');

const comments = await request(`/api/connecta/v1/posts/${postId}/comments?limit=50`, { cookie: alpha.cookie });
if (!Array.isArray(comments.data?.comments) || !comments.data.comments.some((item) => item.body === replyText)) {
  throw new Error('Threaded reply did not persist');
}

const saved = await request('/api/connecta/v1/bookmarks?limit=100', { cookie: alpha.cookie });
if (!Array.isArray(saved.data?.posts) || !saved.data.posts.some((item) => item.id === postId)) {
  throw new Error('Bookmarked post did not appear in bookmarks');
}

const search = await request('/api/connecta/v1/search?q=' + encodeURIComponent(suffix) + '&limit=40', { cookie: alpha.cookie });
if (!Array.isArray(search.data?.posts) || !search.data.posts.some((item) => item.id === postId)) {
  throw new Error('Network search did not find persisted post');
}

const profile = await request('/api/connecta/v1/profiles/' + encodeURIComponent(beta.handle), { cookie: alpha.cookie });
if (profile.data?.profile?.id !== beta.account.id || profile.data?.profile?.viewer_following !== true) {
  throw new Error('Profile/follow state lookup failed');
}

const trends = await request('/api/connecta/v1/trends?limit=20', { cookie: alpha.cookie });
if (!Array.isArray(trends.data?.trends) || !trends.data.trends.some((item) => String(item.tag).toLowerCase() === tag.toLowerCase())) {
  throw new Error('Real hashtag trend extraction failed');
}
if (!String(trends.data?.ranking || '').includes('no behavioural profile')) {
  throw new Error('Trend route did not disclose non-behavioural ranking');
}

const suggestions = await request('/api/connecta/v1/suggestions?limit=10', { cookie: alpha.cookie });
if (!Array.isArray(suggestions.data?.profiles) || !String(suggestions.data?.ranking || '').includes('no behavioural profile')) {
  throw new Error('Suggestion route failed non-behavioural contract');
}

const createdConversation = await request('/api/connecta/v1/conversations', {
  method: 'POST',
  cookie: alpha.cookie,
  body: { handle: beta.handle },
});
const conversationId = createdConversation.data?.conversation?.id;
if (!conversationId) throw new Error('Direct conversation creation failed');

const messageText = `Private runtime message ${suffix}`;
const sent = await request(`/api/connecta/v1/conversations/${conversationId}/messages`, {
  method: 'POST',
  cookie: alpha.cookie,
  body: { body: messageText },
});
if (!sent.data?.message?.id) throw new Error('Direct message send failed');

const messages = await request(`/api/connecta/v1/conversations/${conversationId}/messages?limit=50`, {
  cookie: beta.cookie,
});
if (!Array.isArray(messages.data?.messages) || !messages.data.messages.some((item) => item.body === messageText)) {
  throw new Error('Direct message was not readable by conversation recipient');
}

const notifications = await request('/api/connecta/v1/notifications', { cookie: beta.cookie });
if (!Array.isArray(notifications.data?.notifications) || !notifications.data.notifications.some((item) => item.kind === 'follow')) {
  throw new Error('Social notification pipeline failed');
}

const logout = await request('/api/connecta/v1/auth/logout', { method: 'POST', cookie: alpha.cookie });
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
  profileEdit: true,
  followingFeed: true,
  postPersisted: true,
  threadedReply: true,
  reactionToggle: true,
  repostToggle: true,
  bookmarkToggle: true,
  search: true,
  realHashtagTrends: true,
  behaviouralTrendRanking: false,
  behaviouralSuggestionRanking: false,
  directMessages: true,
  socialNotifications: true,
  communities: true,
  logoutClearsCookie: true,
}));
