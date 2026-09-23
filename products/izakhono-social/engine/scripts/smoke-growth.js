const base = process.env.CONNECTA_ENGINE_URL || 'http://127.0.0.1:4100';
const ownerKey = process.env.CONNECTA_OWNER_KEY;
if (!ownerKey) throw new Error('CONNECTA_OWNER_KEY required');

async function api(path, { method = 'GET', token, body, owner = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (owner) headers['x-connecta-owner-key'] = ownerKey;

  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

const suffix = Date.now().toString(36);

const first = await api('/v1/auth/register', {
  method: 'POST',
  body: {
    email: `founder-${suffix}@connecta.local`,
    handle: `founder-${suffix}`,
    displayName: 'CONNECTA Founder',
    password: 'Correct-Horse-Battery-Staple-01',
  },
});

const invite = await api('/v1/invites', {
  method: 'POST',
  token: first.token,
  body: { label: 'Founding cohort', maxUses: 25, expiresInDays: 30 },
});

const second = await api('/v1/auth/register', {
  method: 'POST',
  body: {
    email: `member-${suffix}@connecta.local`,
    handle: `member-${suffix}`,
    displayName: 'CONNECTA Member',
    password: 'Correct-Horse-Battery-Staple-02',
  },
});

await api(`/v1/invites/${encodeURIComponent(invite.invite.code)}/redeem`, {
  method: 'POST',
  token: second.token,
});

const community = await api('/v1/communities', {
  method: 'POST',
  token: first.token,
  body: {
    name: 'Founding Community',
    slug: `founding-community-${suffix}`,
    description: 'CONNECTA growth-engine smoke test community.',
    visibility: 'public',
  },
});

const groupInvite = await api(`/v1/communities/${community.community.id}/invites`, {
  method: 'POST',
  token: first.token,
  body: { maxUses: 25, expiresInDays: 30 },
});

await api(`/v1/community-invites/${encodeURIComponent(groupInvite.invite.code)}/redeem`, {
  method: 'POST',
  token: second.token,
});

await api(`/v1/follows/${first.account.id}`, {
  method: 'POST',
  token: second.token,
});

await api('/v1/posts', {
  method: 'POST',
  token: second.token,
  body: {
    body: 'Hello CONNECTA. Building useful community without behavioural tracking.',
    visibility: 'public',
  },
});

const discovery = await api('/v1/communities/discover?limit=20', {
  token: second.token,
});

if (!discovery.communities.some((item) => item.id === community.community.id)) {
  throw new Error('Created public community did not appear in discovery');
}

const growth = await api('/v1/admin/growth', { owner: true });
if (Number(growth.totals.active_accounts) < 2) throw new Error('Growth summary did not count accounts');
if (Number(growth.totals.invite_redemptions) < 1) throw new Error('Growth summary did not count invite redemption');
if (Number(growth.totals.activated_accounts) < 1) throw new Error('Activation milestone did not complete');

console.log(JSON.stringify({
  ok: true,
  accounts: growth.totals.active_accounts,
  activations: growth.totals.activated_accounts,
  inviteRedemptions: growth.totals.invite_redemptions,
  communities: growth.totals.active_communities,
}));
