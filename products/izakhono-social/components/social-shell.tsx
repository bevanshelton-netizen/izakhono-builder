'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Account = {
  id: string;
  email: string;
  handle: string;
  display_name?: string;
  displayName?: string;
  status?: string;
};

type FeedPost = {
  id: string;
  body: string;
  visibility: string;
  created_at: string;
  community_id?: string | null;
  handle: string;
  display_name: string;
  relationship_rank?: string | number;
};

type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  read_at?: string | null;
  actor_name?: string | null;
  actor_handle?: string | null;
};

type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  member_count: number;
  joined: boolean;
  created_at: string;
};

type Invite = {
  id: string;
  code: string;
  label?: string;
  use_count: number;
  max_uses?: number | null;
  expires_at?: string | null;
  active: boolean;
};

type Panel = 'Home' | 'Notifications' | 'Communities' | 'Invite people';

const panels: Panel[] = ['Home', 'Notifications', 'Communities', 'Invite people'];
const feedModes = [
  ['balanced', 'Balanced'],
  ['latest', 'Latest'],
  ['following', 'Following'],
  ['communities', 'Communities'],
] as const;

async function api<T = any>(path: string, options: RequestInit = {}): Promise<{ response: Response; data: T }> {
  const response = await fetch('/api/connecta' + path, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body instanceof FormData ? {} : options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'Invalid CONNECTA response' })) as T;
  return { response, data };
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'C';
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' min';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' hr';
  if (seconds < 604800) return Math.floor(seconds / 86400) + ' d';
  return date.toLocaleDateString();
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function AuthGateway({ onReady }: { onReady: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ email: '', password: '', handle: '', displayName: '' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const endpoint = mode === 'register' ? '/v1/auth/register' : '/v1/auth/login';
    const body = mode === 'register'
      ? form
      : { email: form.email, password: form.password };
    const { response, data } = await api<any>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!response.ok) {
      const notice = data?.notice?.title ? data.notice.title + ': ' + data.notice.body : data?.error;
      setMessage(notice || 'CONNECTA could not sign you in.');
      return;
    }
    await onReady();
  }

  return (
    <main className="authPage">
      <section className="authBrand">
        <div className="brandWrap large">
          <div className="brandMark">C</div>
          <div><div className="brand">CONNECTA</div><div className="tagline">People. Communities. Connected.</div></div>
        </div>
        <div className="eyebrow">People, not profiling.</div>
        <h1>A social network built around <span>real relationships</span>, not surveillance.</h1>
        <p>Connect with people and communities while keeping control of your feed, identity and content. No advertising IDs. No silent behavioural profiling.</p>
        <div className="trustTiles">
          <div><strong>Safety enforced</strong><span>Cyberbullying, threats, doxxing, cloning and prohibited abuse are actively handled.</span></div>
          <div><strong>Content protected</strong><span>Shares preserve attribution. Exact and high-confidence altered picture copies can alert the earlier uploader.</span></div>
          <div><strong>Businesses verified</strong><span>Verified-business badges require reviewed evidence and cannot simply be purchased.</span></div>
          <div><strong>Owned engine</strong><span>CONNECTA runs on its own provider-independent engine and PostgreSQL social graph.</span></div>
        </div>
        <div className="authLinks"><Link href="/safety">Safety Centre</Link><Link href="/community-standards">Community Standards</Link></div>
      </section>

      <section className="authCard">
        <div className="authTabs">
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setMessage(''); }}>Create account</button>
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setMessage(''); }}>Sign in</button>
        </div>
        <div className="eyebrow">{mode === 'register' ? 'Founder access' : 'Welcome back'}</div>
        <h2>{mode === 'register' ? 'Join CONNECTA' : 'Sign in to CONNECTA'}</h2>
        <form onSubmit={submit} className="authForm">
          {mode === 'register' && <>
            <label>Display name<input required maxLength={100} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Your name" /></label>
            <label>Handle<input required minLength={3} maxLength={40} value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="your.handle" /></label>
          </>}
          <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
          <label>Password<input required type="password" minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Use a strong passphrase" /></label>
          <button className="authSubmit" disabled={busy}>{busy ? 'Connecting…' : mode === 'register' ? 'Create my CONNECTA account' : 'Sign in'}</button>
        </form>
        {message && <div className="authMessage">{message}</div>}
        <p className="authFine">Your session is kept in a secure HTTP-only cookie. CONNECTA does not store the session token in browser local storage.</p>
      </section>
    </main>
  );
}

export default function SocialShell() {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [notifications, setNotifications] = useState<Notice[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [active, setActive] = useState<Panel>('Home');
  const [feedMode, setFeedMode] = useState('balanced');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);
  const [communityName, setCommunityName] = useState('');
  const [communityDescription, setCommunityDescription] = useState('');
  const [inviteLabel, setInviteLabel] = useState('Founder invite');

  const displayName = account?.display_name || account?.displayName || account?.handle || 'CONNECTA member';
  const unread = notifications.filter((item) => !item.read_at).length;
  const joinedCommunities = communities.filter((item) => item.joined).length;
  const activationSteps = useMemo(() => [
    { label: 'Profile created', done: Boolean(account) },
    { label: 'Join or create a community', done: joinedCommunities > 0 },
    { label: 'Publish your first meaningful post', done: posts.some((post) => post.handle === account?.handle) },
  ], [account, joinedCommunities, posts]);

  const loadFeed = useCallback(async (mode = feedMode) => {
    const { response, data } = await api<any>('/v1/feed?mode=' + encodeURIComponent(mode) + '&limit=50');
    if (response.ok) setPosts(Array.isArray(data.posts) ? data.posts : []);
  }, [feedMode]);

  const hydrate = useCallback(async () => {
    setLoading(true);
    const me = await api<any>('/v1/me');
    if (!me.response.ok) {
      setAccount(null);
      setLoading(false);
      return;
    }
    setAccount(me.data.account);
    const [feed, noticeResult, communityResult, inviteResult] = await Promise.all([
      api<any>('/v1/feed?mode=' + encodeURIComponent(feedMode) + '&limit=50'),
      api<any>('/v1/notifications'),
      api<any>('/v1/communities/discover?limit=50'),
      api<any>('/v1/invites'),
    ]);
    if (feed.response.ok) setPosts(feed.data.posts || []);
    if (noticeResult.response.ok) setNotifications(noticeResult.data.notifications || []);
    if (communityResult.response.ok) setCommunities(communityResult.data.communities || []);
    if (inviteResult.response.ok) setInvites(inviteResult.data.invites || []);
    setLoading(false);
  }, [feedMode]);

  useEffect(() => { void hydrate(); }, [hydrate]);

  async function publish(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || working) return;
    setWorking(true);
    setStatus('Publishing through CONNECTA ENGINE…');
    const { response, data } = await api<any>('/v1/posts', {
      method: 'POST',
      body: JSON.stringify({ body: text, visibility: 'public' }),
    });
    setWorking(false);
    if (!response.ok) {
      setStatus(data?.message || data?.error || 'Post could not be published.');
      if (response.status === 401 || response.status === 423) setAccount(null);
      return;
    }
    setDraft('');
    setStatus(data?.post?.moderation_state === 'review'
      ? 'Your post is being reviewed before public distribution.'
      : 'Published through the sovereign CONNECTA ENGINE.');
    await loadFeed();
  }

  async function changeFeed(mode: string) {
    setFeedMode(mode);
    await loadFeed(mode);
  }

  async function joinCommunity(id: string) {
    setWorking(true);
    const { response, data } = await api<any>('/v1/communities/' + id + '/join', { method: 'POST' });
    setWorking(false);
    setStatus(response.ok ? 'Community joined.' : data?.error || 'Could not join community.');
    if (response.ok) await hydrate();
  }

  async function createCommunity(event: FormEvent) {
    event.preventDefault();
    const name = communityName.trim();
    if (!name) return;
    setWorking(true);
    const { response, data } = await api<any>('/v1/communities', {
      method: 'POST',
      body: JSON.stringify({
        name,
        slug: slugify(name),
        description: communityDescription,
        visibility: 'public',
      }),
    });
    setWorking(false);
    if (!response.ok) {
      setStatus(data?.error || 'Could not create community.');
      return;
    }
    setCommunityName('');
    setCommunityDescription('');
    setStatus('Community created. You are its founding owner.');
    await hydrate();
  }

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    const { response, data } = await api<any>('/v1/invites', {
      method: 'POST',
      body: JSON.stringify({ label: inviteLabel || 'CONNECTA invite', expiresInDays: 30, maxUses: 25 }),
    });
    setWorking(false);
    if (!response.ok) {
      setStatus(data?.error || 'Could not create invite.');
      return;
    }
    setStatus('Founder invite created.');
    await hydrate();
  }

  async function sharePost(post: FeedPost) {
    const { response, data } = await api<any>('/v1/shares', {
      method: 'POST',
      body: JSON.stringify({ sourceType: 'post', sourceId: post.id, commentary: '' }),
    });
    setStatus(response.ok
      ? 'Shared with original attribution. The original owner was alerted.'
      : data?.error || 'Could not share this post.');
  }

  async function reportPost(post: FeedPost) {
    const reason = window.prompt('Describe the safety concern (for example: cyberbullying, threat, doxxing, impersonation or scam).');
    if (!reason?.trim()) return;
    const { response, data } = await api<any>('/v1/reports', {
      method: 'POST',
      body: JSON.stringify({ targetType: 'post', targetId: post.id, reason: reason.trim(), detail: reason.trim() }),
    });
    setStatus(response.ok
      ? data?.message || 'Safety report submitted.'
      : data?.error || 'Could not submit report.');
  }

  async function markRead(notice: Notice) {
    if (notice.read_at) return;
    const { response } = await api('/v1/notifications/' + notice.id + '/read', { method: 'POST' });
    if (response.ok) {
      setNotifications((items) => items.map((item) => item.id === notice.id ? { ...item, read_at: new Date().toISOString() } : item));
    }
  }

  async function logout() {
    await api('/v1/auth/logout', { method: 'POST' });
    setAccount(null);
    setPosts([]);
    setNotifications([]);
    setCommunities([]);
    setInvites([]);
    setActive('Home');
  }

  async function copyInvite(code: string) {
    const link = window.location.origin + '/?invite=' + encodeURIComponent(code);
    await navigator.clipboard?.writeText(link);
    setStatus('Invite link copied.');
  }

  if (loading) {
    return <main className="loadingPage"><div className="brandMark">C</div><strong>CONNECTA</strong><span>Connecting to the sovereign engine…</span></main>;
  }

  if (!account) return <AuthGateway onReady={hydrate} />;

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brandWrap">
          <div className="brandMark">C</div>
          <div><div className="brand">CONNECTA</div><div className="tagline">People. Communities. Connected.</div></div>
        </div>
        <div className="engineStatus"><span className="liveDot" /> Sovereign engine connected</div>
        <div className="topActions">
          <button className="iconButton notificationBell" aria-label="Notifications" onClick={() => setActive('Notifications')}>✦{unread > 0 && <b>{unread}</b>}</button>
          <button className="profileButton"><span className="avatar small">{initials(displayName)}</span><span>@{account.handle}</span></button>
          <button className="logoutButton" onClick={logout}>Sign out</button>
        </div>
      </header>

      <div className="privacyStrip"><strong>People, not profiling.</strong> No advertising IDs. No silent tracking. Your feed controls belong to you.</div>

      <div className="threeColumn">
        <aside className="leftRail">
          <nav className="navList">
            {panels.map((item) => <button key={item} className={active === item ? 'navItem active' : 'navItem'} onClick={() => setActive(item)}>
              <span className="navDot" />{item}{item === 'Notifications' && unread > 0 ? <em>{unread}</em> : null}
            </button>)}
          </nav>
          <div className="railCard">
            <div className="eyebrow">Your feed</div>
            <h3>You choose the signal.</h3>
            <p>Balanced, Latest, Following or Communities. No hidden engagement trap.</p>
            <select value={feedMode} onChange={(e) => void changeFeed(e.target.value)}>
              {feedModes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </div>
          <div className="railLinks"><Link href="/safety">Safety Centre</Link><Link href="/community-standards">Community Standards</Link></div>
        </aside>

        <section className="feed">
          {status && <div className="globalStatus"><span>{status}</span><button onClick={() => setStatus('')}>×</button></div>}

          {active === 'Home' && <>
            <div className="heroCard">
              <div><div className="eyebrow">Founder network</div><h1>Welcome, {displayName.split(' ')[0]}.<br/><span>Build your real community.</span></h1><p>CONNECTA is now using its sovereign engine for your account, feed, posts, communities, invitations and safety controls.</p></div>
              <div className="heroSeal"><strong>REAL</strong><span>engine-backed</span></div>
            </div>

            <div className="activationCard">
              <div><div className="eyebrow">Activation path</div><h3>Three actions. Then CONNECTA starts working for you.</h3></div>
              <div className="activationSteps">
                {activationSteps.map((step) => <div className={step.done ? 'activationStep done' : 'activationStep'} key={step.label}><span>{step.done ? '✓' : '○'}</span>{step.label}</div>)}
              </div>
            </div>

            <form className="composer" onSubmit={publish}>
              <div className="composerTop"><span className="avatar">{initials(displayName)}</span><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Share something meaningful…" maxLength={8000} /></div>
              <div className="composerBottom"><div className="composerHint">Public post · server-side safety enforcement</div><button className="postButton" disabled={working} type="submit">{working ? 'Working…' : 'Post'}</button></div>
            </form>

            <div className="feedHeader"><div><strong>{feedModes.find(([value]) => value === feedMode)?.[1]} feed</strong><span>{posts.length} real post{posts.length === 1 ? '' : 's'} from CONNECTA ENGINE</span></div><button onClick={() => void loadFeed()}>Refresh</button></div>

            {posts.length === 0 ? <div className="emptyState"><strong>Your real feed starts here.</strong><p>Join a community and publish the first post. CONNECTA will not fill your feed with fake engagement.</p><button onClick={() => setActive('Communities')}>Discover communities</button></div> : posts.map((post) => <article className="postCard" key={post.id}>
              <div className="postHeader"><span className="avatar">{initials(post.display_name)}</span><div className="postIdentity"><div><strong>{post.display_name}</strong></div><span>@{post.handle} · {when(post.created_at)}</span></div><button className="more" aria-label="More options">•••</button></div>
              <p className="postText">{post.body}</p>
              <div className="postMeta"><span>{post.community_id ? 'Community post' : 'Public post'}</span><span>{post.visibility}</span></div>
              <div className="postActions"><button onClick={() => void api('/v1/posts/' + post.id + '/reactions', { method: 'POST', body: JSON.stringify({ kind: 'appreciate' }) }).then(() => setStatus('Appreciated.'))}>♡ Appreciate</button><button onClick={() => void sharePost(post)}>↗ Share</button><button onClick={() => void reportPost(post)}>⚑ Report</button></div>
            </article>)}
          </>}

          {active === 'Notifications' && <>
            <div className="sectionIntro"><div className="eyebrow">Private first-party alerts</div><h2>Notifications</h2><p>Safety, content-owner and business verification alerts stay inside CONNECTA. They are not used for behavioural advertising.</p></div>
            {notifications.length === 0 ? <div className="emptyState"><strong>No notifications yet.</strong><p>When someone shares your content, CONNECTA detects a possible copied picture, or a verification action occurs, it will appear here.</p></div> :
              notifications.map((notice) => <button className={notice.read_at ? 'noticeCard read' : 'noticeCard'} onClick={() => void markRead(notice)} key={notice.id}>
                <div><span className="noticeKind">{notice.kind.replaceAll('_', ' ')}</span><span>{when(notice.created_at)}</span></div>
                <strong>{notice.title}</strong><p>{notice.body}</p>
              </button>)}
          </>}

          {active === 'Communities' && <>
            <div className="sectionIntro"><div className="eyebrow">Relationship-led growth</div><h2>Communities</h2><p>Join a real public community or create one for your school, club, neighbourhood, business, creative network or cause.</p></div>
            <form className="createCommunityCard" onSubmit={createCommunity}>
              <h3>Create a community</h3>
              <input value={communityName} onChange={(e) => setCommunityName(e.target.value)} required maxLength={120} placeholder="Community name" />
              <textarea value={communityDescription} onChange={(e) => setCommunityDescription(e.target.value)} maxLength={1000} placeholder="What is this community for?" />
              <button disabled={working}>Create community</button>
            </form>
            <div className="communityGrid">
              {communities.length === 0 ? <div className="emptyState"><strong>No public communities yet.</strong><p>You can become the first founder.</p></div> : communities.map((community) => <article className="communityCard" key={community.id}>
                <div className="communityIcon">{initials(community.name)}</div>
                <div><h3>{community.name}</h3><span>@{community.slug} · {Number(community.member_count || 0).toLocaleString()} member{Number(community.member_count || 0) === 1 ? '' : 's'}</span><p>{community.description || 'A CONNECTA community.'}</p></div>
                <button disabled={community.joined || working} onClick={() => void joinCommunity(community.id)}>{community.joined ? 'Joined' : 'Join'}</button>
              </article>)}
            </div>
          </>}

          {active === 'Invite people' && <>
            <div className="sectionIntro"><div className="eyebrow">Founder programme</div><h2>Invite real people</h2><p>Grow CONNECTA through people who already trust one another. Invite links are explicit and user-controlled—never scraped or spammed.</p></div>
            <form className="inviteCreator" onSubmit={createInvite}>
              <input value={inviteLabel} onChange={(e) => setInviteLabel(e.target.value)} maxLength={80} placeholder="Invite label" />
              <button disabled={working}>Create 30-day invite</button>
            </form>
            <div className="inviteList">
              {invites.length === 0 ? <div className="emptyState"><strong>No invite codes yet.</strong><p>Create your first founder invite above.</p></div> : invites.map((invite) => <div className="inviteCard" key={invite.id}>
                <div><span>{invite.label || 'CONNECTA invite'}</span><strong>{invite.code}</strong><small>{invite.use_count || 0} use{invite.use_count === 1 ? '' : 's'} · {invite.active ? 'active' : 'inactive'}</small></div>
                <button onClick={() => void copyInvite(invite.code)}>Copy link</button>
              </div>)}
            </div>
          </>}
        </section>

        <aside className="rightRail">
          <div className="safetyCard"><div className="shield">✓</div><div><div className="eyebrow">Safety Centre</div><h3>Clean social, enforced.</h3></div>
            <div className="safetyRules"><span>No cyberbullying</span><span>No threats or doxxing</span><span>No account cloning</span><span>Owner alerts on shares/copies</span><span>Businesses verified before badge</span><span>No drugs or porn</span><span>No gang recruitment</span><span>Zero tolerance for child sexual exploitation</span></div>
            <Link href="/safety" className="primaryLink">See how safety works →</Link>
          </div>

          <div className="sideCard founderCard"><div className="eyebrow">Your founder progress</div><h3>{activationSteps.filter((step) => step.done).length}/3 activation steps</h3>
            {activationSteps.map((step) => <div className="miniStep" key={step.label}><span>{step.done ? '✓' : '○'}</span>{step.label}</div>)}
          </div>

          <div className="sideCard"><div className="sideTitle"><h3>Public communities</h3><button onClick={() => setActive('Communities')}>See all</button></div>
            {communities.slice(0, 4).map((community) => <div className="community" key={community.id}><span className="communityIcon">{initials(community.name)}</span><div><strong>{community.name}</strong><span>{Number(community.member_count || 0).toLocaleString()} members</span></div></div>)}
            {communities.length === 0 && <p className="smallMuted">No public communities yet. Found one.</p>}
          </div>
        </aside>
      </div>
    </main>
  );
}
