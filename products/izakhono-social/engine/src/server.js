import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import { query, transaction } from './db.js';
import { moderateText } from './moderation.js';
import {
  bearerToken,
  hashPassword,
  hashToken,
  newSessionToken,
  normalizeEmail,
  normalizeHandle,
  safeEqualText,
  validHandle,
  validatePassword,
  verifyPassword,
} from './security.js';

const PORT = Number(process.env.PORT || 4100);
const MEDIA_ROOT = path.resolve(process.env.MEDIA_ROOT || '/var/lib/connecta/media');
const MAX_JSON_BYTES = Number(process.env.MAX_JSON_BYTES || 1_000_000);
const MAX_MEDIA_BYTES = Number(process.env.MAX_MEDIA_BYTES || 25 * 1024 * 1024);
const SESSION_DAYS = Math.min(Math.max(Number(process.env.SESSION_DAYS || 30), 1), 90);
const OWNER_KEY = process.env.CONNECTA_OWNER_KEY || '';
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

await mkdir(MEDIA_ROOT, { recursive: true });

function send(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...extraHeaders,
  });
  res.end(body);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('access-control-allow-headers', 'authorization,content-type,x-connecta-owner-key');
  }
}

async function readJson(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BYTES) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

async function readRaw(req, maxBytes) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('Media too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function accountFromRequest(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const result = await query(
    `select a.id, a.email, a.status, p.handle, p.display_name, p.visibility
       from sessions s
       join accounts a on a.id=s.account_id
       join profiles p on p.account_id=a.id
      where s.token_hash=$1
        and s.revoked_at is null
        and s.expires_at > now()
        and a.status='active'
      limit 1`,
    [tokenHash],
  );
  if (!result.rowCount) return null;
  await query('update sessions set last_seen_at=now() where token_hash=$1', [tokenHash]);
  return { ...result.rows[0], tokenHash };
}

async function requireAccount(req, res) {
  const account = await accountFromRequest(req);
  if (!account) {
    send(res, 401, { ok: false, error: 'Authentication required' });
    return null;
  }
  return account;
}

function requireOwner(req, res) {
  if (!OWNER_KEY || !safeEqualText(req.headers['x-connecta-owner-key'], OWNER_KEY)) {
    send(res, 401, { ok: false, error: 'Owner authorization required' });
    return false;
  }
  return true;
}

async function audit(eventType, accountId = null, targetType = null, targetId = null, detail = {}) {
  await query(
    'insert into audit_events(actor_subject,event_type,target_type,target_id,detail) values($1,$2,$3,$4,$5::jsonb)',
    [accountId, eventType, targetType, targetId, JSON.stringify(detail)],
  );
}

async function rateLimit(key, limit, seconds) {
  const result = await query(
    `insert into rate_limit_buckets(bucket_key,window_started_at,hit_count)
       values($1,now(),1)
       on conflict(bucket_key) do update set
         window_started_at = case
           when rate_limit_buckets.window_started_at < now() - ($3 || ' seconds')::interval then now()
           else rate_limit_buckets.window_started_at
         end,
         hit_count = case
           when rate_limit_buckets.window_started_at < now() - ($3 || ' seconds')::interval then 1
           else rate_limit_buckets.hit_count + 1
         end
       returning hit_count`,
    [key, limit, String(seconds)],
  );
  return Number(result.rows[0]?.hit_count || 0) <= limit;
}

function remoteKey(req) {
  return String(req.socket.remoteAddress || 'unknown').slice(0, 80);
}

async function createSession(client, accountId) {
  const { token, tokenHash } = newSessionToken();
  await client.query(
    `insert into sessions(account_id,token_hash,expires_at)
     values($1,$2,now()+($3 || ' days')::interval)`,
    [accountId, tokenHash, String(SESSION_DAYS)],
  );
  return token;
}

async function register(req, res) {
  if (!(await rateLimit(`register:${remoteKey(req)}`, 8, 3600))) {
    return send(res, 429, { ok: false, error: 'Too many registration attempts' });
  }

  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const handle = normalizeHandle(body.handle);
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 100) : '';
  const passwordError = validatePassword(body.password);

  if (!email || !email.includes('@')) return send(res, 400, { ok: false, error: 'Valid email required' });
  if (!validHandle(handle)) return send(res, 400, { ok: false, error: 'Handle must be 3-40 characters using letters, numbers, dot, underscore or hyphen' });
  if (!displayName) return send(res, 400, { ok: false, error: 'Display name required' });
  if (passwordError) return send(res, 400, { ok: false, error: passwordError });

  const password = await hashPassword(body.password);
  try {
    const result = await transaction(async (client) => {
      const account = await client.query(
        `insert into accounts(auth_subject,email,status)
         values($1,$2,'active') returning id,email,status`,
        [`local:${email}`, email],
      );
      const accountId = account.rows[0].id;
      await client.query(
        `insert into profiles(account_id,handle,display_name)
         values($1,$2,$3)`,
        [accountId, handle, displayName],
      );
      await client.query(
        `insert into password_credentials(account_id,password_salt,password_hash)
         values($1,$2,$3)`,
        [accountId, password.salt, password.hash],
      );
      const token = await createSession(client, accountId);
      return { accountId, token };
    });
    await audit('account.registered', result.accountId, 'account', result.accountId);
    return send(res, 201, { ok: true, account: { id: result.accountId, email, handle, displayName }, token: result.token });
  } catch (error) {
    if (String(error?.code) === '23505') return send(res, 409, { ok: false, error: 'Email or handle already registered' });
    throw error;
  }
}

async function login(req, res) {
  if (!(await rateLimit(`login:${remoteKey(req)}`, 20, 900))) {
    return send(res, 429, { ok: false, error: 'Too many login attempts' });
  }

  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const result = await query(
    `select a.id,a.email,a.status,p.handle,p.display_name,c.password_salt,c.password_hash
       from accounts a
       join profiles p on p.account_id=a.id
       join password_credentials c on c.account_id=a.id
      where lower(a.email)=lower($1)
      limit 1`,
    [email],
  );

  const row = result.rows[0];
  const valid = row && row.status === 'active' && await verifyPassword(body.password || '', row.password_salt, row.password_hash);
  if (!valid) return send(res, 401, { ok: false, error: 'Invalid credentials' });

  const token = await transaction((client) => createSession(client, row.id));
  await audit('session.created', row.id, 'account', row.id);
  return send(res, 200, {
    ok: true,
    account: { id: row.id, email: row.email, handle: row.handle, displayName: row.display_name },
    token,
  });
}

async function feed(req, res, account) {
  const url = new URL(req.url, 'http://connecta.local');
  const allowedModes = new Set(['latest', 'following', 'connections', 'communities', 'balanced']);
  const mode = allowedModes.has(url.searchParams.get('mode')) ? url.searchParams.get('mode') : 'balanced';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 30), 1), 100);

  let where = `p.deleted_at is null and p.moderation_state='allowed' and p.visibility='public'`;
  let score = '0';

  if (mode === 'following') {
    where += ` and exists(select 1 from follows f where f.follower_id=$1 and f.followed_id=p.author_id)`;
  } else if (mode === 'connections') {
    where += ` and exists(
      select 1 from connections c
      where c.status='accepted'
        and ((c.requester_id=$1 and c.addressee_id=p.author_id)
          or (c.addressee_id=$1 and c.requester_id=p.author_id))
    )`;
  } else if (mode === 'communities') {
    where = `p.deleted_at is null and p.moderation_state='allowed'
      and p.community_id is not null
      and exists(select 1 from community_members cm
        where cm.account_id=$1 and cm.community_id=p.community_id and cm.status='active')`;
  } else if (mode === 'balanced') {
    score = `(
      case when exists(select 1 from follows f where f.follower_id=$1 and f.followed_id=p.author_id) then 3 else 0 end +
      case when exists(select 1 from connections c where c.status='accepted' and ((c.requester_id=$1 and c.addressee_id=p.author_id) or (c.addressee_id=$1 and c.requester_id=p.author_id))) then 4 else 0 end +
      case when p.community_id is not null and exists(select 1 from community_members cm where cm.account_id=$1 and cm.community_id=p.community_id and cm.status='active') then 2 else 0 end
    )`;
  }

  const result = await query(
    `select p.id,p.body,p.visibility,p.created_at,p.community_id,
            pr.handle,pr.display_name,
            ${score} as relationship_rank
       from posts p
       join profiles pr on pr.account_id=p.author_id
      where ${where}
      order by relationship_rank desc, p.created_at desc
      limit $2`,
    [account.id, limit],
  );

  return send(res, 200, {
    ok: true,
    mode,
    ranking: mode === 'balanced'
      ? 'Explicit relationship strength + recency only; no behavioural tracking.'
      : 'Chronological within the selected explicit relationship scope.',
    posts: result.rows,
  });
}

async function createPost(req, res, account) {
  if (!(await rateLimit(`post:${account.id}`, 60, 3600))) {
    return send(res, 429, { ok: false, error: 'Posting rate limit reached' });
  }

  const body = await readJson(req);
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 8000) : '';
  if (!text) return send(res, 400, { ok: false, error: 'Post body required' });

  const moderation = moderateText(text);
  if (moderation.action === 'block') {
    await audit('post.blocked_before_publish', account.id, null, null, { categories: moderation.categories });
    return send(res, 422, { ok: false, moderation });
  }

  const visibility = ['public', 'connections', 'community', 'private'].includes(body.visibility)
    ? body.visibility
    : 'public';
  const communityId = typeof body.communityId === 'string' ? body.communityId : null;
  const moderationState = moderation.action === 'review' ? 'review' : 'allowed';

  const result = await transaction(async (client) => {
    const created = await client.query(
      `insert into posts(author_id,community_id,body,visibility,moderation_state)
       values($1,$2,$3,$4,$5)
       returning id,body,visibility,moderation_state,created_at`,
      [account.id, communityId, text, visibility, moderationState],
    );
    const post = created.rows[0];
    if (moderationState === 'review') {
      await client.query(
        `insert into moderation_cases(source,target_type,target_id,category,severity,state,rationale)
         values('automatic','post',$1,$2,2,'open',$3)`,
        [post.id, moderation.categories.join(','), moderation.reason],
      );
    }
    return post;
  });

  await audit('post.created', account.id, 'post', result.id, { moderationState });
  return send(res, 201, { ok: true, post: result, moderation });
}

async function createComment(req, res, account, postId) {
  const body = await readJson(req);
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 4000) : '';
  if (!text) return send(res, 400, { ok: false, error: 'Comment body required' });

  const moderation = moderateText(text);
  if (moderation.action === 'block') return send(res, 422, { ok: false, moderation });
  const state = moderation.action === 'review' ? 'review' : 'allowed';

  const result = await transaction(async (client) => {
    const created = await client.query(
      `insert into comments(post_id,author_id,parent_comment_id,body,moderation_state)
       values($1,$2,$3,$4,$5)
       returning id,post_id,body,moderation_state,created_at`,
      [postId, account.id, body.parentCommentId || null, text, state],
    );
    if (state === 'review') {
      await client.query(
        `insert into moderation_cases(source,target_type,target_id,category,severity,state,rationale)
         values('automatic','comment',$1,$2,2,'open',$3)`,
        [created.rows[0].id, moderation.categories.join(','), moderation.reason],
      );
    }
    return created.rows[0];
  });
  return send(res, 201, { ok: true, comment: result, moderation });
}

async function react(req, res, account, postId) {
  const body = await readJson(req);
  const allowed = ['appreciate', 'support', 'celebrate', 'insightful'];
  const kind = allowed.includes(body.kind) ? body.kind : 'appreciate';
  await query(
    `insert into reactions(actor_id,post_id,kind)
     values($1,$2,$3)
     on conflict(actor_id,post_id,comment_id,kind) do nothing`,
    [account.id, postId, kind],
  );
  return send(res, 200, { ok: true, kind });
}

async function follow(req, res, account, targetId) {
  if (targetId === account.id) return send(res, 400, { ok: false, error: 'Cannot follow yourself' });
  await query(
    `insert into follows(follower_id,followed_id) values($1,$2)
     on conflict do nothing`,
    [account.id, targetId],
  );
  return send(res, 200, { ok: true });
}

async function connect(req, res, account, targetId) {
  if (targetId === account.id) return send(res, 400, { ok: false, error: 'Cannot connect to yourself' });
  try {
    await query(
      `insert into connections(requester_id,addressee_id,status)
       values($1,$2,'pending')`,
      [account.id, targetId],
    );
  } catch (error) {
    if (String(error?.code) !== '23505') throw error;
  }
  return send(res, 200, { ok: true, status: 'pending' });
}

async function reportTarget(req, res, account) {
  const body = await readJson(req);
  const allowedTypes = ['account', 'post', 'comment', 'message', 'community', 'media'];
  if (!allowedTypes.includes(body.targetType) || typeof body.targetId !== 'string') {
    return send(res, 400, { ok: false, error: 'Valid targetType and targetId required' });
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 120) : '';
  const detail = typeof body.detail === 'string' ? body.detail.trim().slice(0, 2000) : '';
  if (!reason) return send(res, 400, { ok: false, error: 'Reason required' });

  const result = await transaction(async (client) => {
    const report = await client.query(
      `insert into reports(reporter_id,target_type,target_id,reason,detail)
       values($1,$2,$3,$4,$5) returning id`,
      [account.id, body.targetType, body.targetId, reason, detail],
    );
    await client.query(
      `insert into moderation_cases(source,target_type,target_id,category,severity,state,rationale)
       values('user_report',$1,$2,$3,2,'open',$4)`,
      [body.targetType, body.targetId, reason, detail],
    );
    return report.rows[0];
  });
  return send(res, 201, { ok: true, reportId: result.id });
}

async function createMedia(req, res, account) {
  const body = await readJson(req);
  const allowedTypes = ['image', 'video', 'audio', 'document'];
  const mediaType = allowedTypes.includes(body.mediaType) ? body.mediaType : null;
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.slice(0, 120) : '';
  if (!mediaType || !mimeType) return send(res, 400, { ok: false, error: 'mediaType and mimeType required' });

  const id = randomUUID();
  const objectKey = `${account.id}/${id}`;
  await query(
    `insert into media_assets(id,owner_id,object_key,media_type,mime_type,byte_size,moderation_state)
     values($1,$2,$3,$4,$5,0,'pending')`,
    [id, account.id, objectKey, mediaType, mimeType],
  );
  return send(res, 201, {
    ok: true,
    media: { id, state: 'pending', uploadPath: `/v1/media/${id}/content` },
  });
}

async function uploadMedia(req, res, account, mediaId) {
  const result = await query(
    `select id,owner_id,object_key,mime_type,moderation_state
       from media_assets where id=$1 limit 1`,
    [mediaId],
  );
  const media = result.rows[0];
  if (!media || media.owner_id !== account.id) return send(res, 404, { ok: false, error: 'Media not found' });
  if (media.moderation_state === 'blocked' || media.moderation_state === 'removed') {
    return send(res, 409, { ok: false, error: 'Media cannot be updated' });
  }

  const bytes = await readRaw(req, MAX_MEDIA_BYTES);
  const diskPath = path.join(MEDIA_ROOT, media.object_key);
  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, bytes, { mode: 0o600 });
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await query(
    `update media_assets set byte_size=$1,sha256=$2,moderation_state='review' where id=$3`,
    [bytes.length, sha256, mediaId],
  );
  await query(
    `insert into moderation_cases(source,target_type,target_id,category,severity,state,rationale)
     values('automatic','media',$1,'media-review-required',2,'open','Uploaded media requires review before public distribution')`,
    [mediaId],
  );
  return send(res, 200, { ok: true, media: { id: mediaId, byteSize: bytes.length, sha256, state: 'review' } });
}

async function moderationQueue(req, res) {
  if (!requireOwner(req, res)) return;
  const result = await query(
    `select id,source,target_type,target_id,category,severity,state,rationale,created_at
       from moderation_cases
      where state in ('open','reviewing')
      order by severity desc, created_at asc
      limit 200`,
  );
  return send(res, 200, { ok: true, cases: result.rows });
}

async function resolveModeration(req, res, caseId) {
  if (!requireOwner(req, res)) return;
  const body = await readJson(req);
  const allowedActions = ['none', 'limit', 'remove', 'suspend', 'disable'];
  const action = allowedActions.includes(body.action) ? body.action : 'none';
  const state = action === 'none' ? 'cleared' : 'actioned';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';

  const result = await transaction(async (client) => {
    const locked = await client.query('select * from moderation_cases where id=$1 for update', [caseId]);
    if (!locked.rowCount) return null;
    const item = locked.rows[0];
    await client.query(
      `update moderation_cases
          set state=$1,action=$2,rationale=case when $3='' then rationale else $3 end,
              reviewer_subject='owner',updated_at=now()
        where id=$4`,
      [state, action, note, caseId],
    );
    if (item.target_type === 'post') {
      await client.query(
        `update posts set moderation_state=$1 where id=$2`,
        [action === 'none' ? 'allowed' : 'removed', item.target_id],
      );
    } else if (item.target_type === 'comment') {
      await client.query(
        `update comments set moderation_state=$1 where id=$2`,
        [action === 'none' ? 'allowed' : 'removed', item.target_id],
      );
    } else if (item.target_type === 'media') {
      await client.query(
        `update media_assets set moderation_state=$1 where id=$2`,
        [action === 'none' ? 'allowed' : 'removed', item.target_id],
      );
    }
    return item;
  });

  if (!result) return send(res, 404, { ok: false, error: 'Moderation case not found' });
  return send(res, 200, { ok: true, state, action });
}

async function mediaContent(req, res, account, mediaId) {
  const result = await query(
    `select m.*, p.visibility
       from media_assets m
       join profiles p on p.account_id=m.owner_id
      where m.id=$1 limit 1`,
    [mediaId],
  );
  const media = result.rows[0];
  if (!media) return send(res, 404, { ok: false, error: 'Media not found' });
  if (media.owner_id !== account.id && media.moderation_state !== 'allowed') {
    return send(res, 403, { ok: false, error: 'Media is not available' });
  }
  const bytes = await readFile(path.join(MEDIA_ROOT, media.object_key)).catch(() => null);
  if (!bytes) return send(res, 404, { ok: false, error: 'Media content missing' });
  res.writeHead(200, {
    'content-type': media.mime_type,
    'content-length': bytes.length,
    'cache-control': 'private, max-age=60',
    'x-content-type-options': 'nosniff',
  });
  res.end(bytes);
}

async function route(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, 'http://connecta.local');
  if (req.method === 'GET' && url.pathname === '/health') {
    const database = await query('select 1 as ok').then(() => 'ok').catch(() => 'error');
    return send(res, database === 'ok' ? 200 : 503, {
      ok: database === 'ok',
      service: 'CONNECTA ENGINE',
      version: '0.1.0',
      database,
      providerIndependent: true,
      behaviouralTracking: false,
    });
  }

  if (req.method === 'POST' && url.pathname === '/v1/auth/register') return register(req, res);
  if (req.method === 'POST' && url.pathname === '/v1/auth/login') return login(req, res);

  if (req.method === 'GET' && url.pathname === '/v1/admin/moderation') return moderationQueue(req, res);
  const adminCase = url.pathname.match(/^\/v1\/admin\/moderation\/([0-9a-f-]+)$/i);
  if (req.method === 'PATCH' && adminCase) return resolveModeration(req, res, adminCase[1]);

  const account = await requireAccount(req, res);
  if (!account) return;

  if (req.method === 'POST' && url.pathname === '/v1/auth/logout') {
    await query('update sessions set revoked_at=now() where token_hash=$1', [account.tokenHash]);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/v1/me') return send(res, 200, { ok: true, account });
  if (req.method === 'GET' && url.pathname === '/v1/feed') return feed(req, res, account);
  if (req.method === 'POST' && url.pathname === '/v1/posts') return createPost(req, res, account);
  if (req.method === 'POST' && url.pathname === '/v1/reports') return reportTarget(req, res, account);
  if (req.method === 'POST' && url.pathname === '/v1/media') return createMedia(req, res, account);

  const postComment = url.pathname.match(/^\/v1\/posts\/([0-9a-f-]+)\/comments$/i);
  if (req.method === 'POST' && postComment) return createComment(req, res, account, postComment[1]);

  const postReaction = url.pathname.match(/^\/v1\/posts\/([0-9a-f-]+)\/reactions$/i);
  if (req.method === 'POST' && postReaction) return react(req, res, account, postReaction[1]);

  const followMatch = url.pathname.match(/^\/v1\/follows\/([0-9a-f-]+)$/i);
  if (req.method === 'POST' && followMatch) return follow(req, res, account, followMatch[1]);

  const connectionMatch = url.pathname.match(/^\/v1\/connections\/([0-9a-f-]+)$/i);
  if (req.method === 'POST' && connectionMatch) return connect(req, res, account, connectionMatch[1]);

  const uploadMatch = url.pathname.match(/^\/v1\/media\/([0-9a-f-]+)\/content$/i);
  if (req.method === 'PUT' && uploadMatch) return uploadMedia(req, res, account, uploadMatch[1]);
  if (req.method === 'GET' && uploadMatch) return mediaContent(req, res, account, uploadMatch[1]);

  return send(res, 404, { ok: false, error: 'Route not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    console.error('CONNECTA engine request failed:', error?.message || error);
    if (!res.headersSent) {
      send(res, Number(error?.status || 500), {
        ok: false,
        error: Number(error?.status) && Number(error.status) < 500 ? error.message : 'Internal server error',
      });
    } else {
      res.end();
    }
  }
});

server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CONNECTA ENGINE listening on :${PORT}`);
});
