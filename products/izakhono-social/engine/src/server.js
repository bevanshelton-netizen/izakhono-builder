import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

import { fingerprintImage, supportsPerceptualFingerprint } from './media-fingerprint.js';

import { query, transaction } from './db.js';
import {
  getMedia,
  initializeStorage,
  putMedia,
  storageHealth,
  storageInfo,
} from './storage.js';
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
import {
  createCommunity,
  createCommunityInvite,
  createInvite,
  discoverCommunities,
  growthSummary,
  initializeOnboarding,
  joinCommunity,
  listInvites,
  markMilestone,
  redeemCommunityInvite,
  redeemInvite,
} from './growth.js';
import {
  automaticViolation,
  clearSafetyCase,
  confirmViolation,
  listIdentityAlerts,
  listSafetyNotices,
  protectIdentity,
  safetyReport,
  scanIdentityClone,
} from './safety.js';
import {
  addBusinessEvidence,
  decideBusinessEvidence,
  decideBusinessVerification,
  duplicateMediaCheck,
  listBusinessVerifications,
  perceptualMediaCheck,
  listNotifications,
  markNotificationRead,
  publicBusiness,
  saveMediaFingerprint,
  shareContent,
  submitBusinessVerification,
} from './trust.js';

const PORT = Number(process.env.PORT || 4100);
const ENGINE_VERSION = process.env.CONNECTA_ENGINE_VERSION || '0.2.0';
const ENGINE_INSTANCE = process.env.CONNECTA_ENGINE_INSTANCE || 'connecta-engine';
const MAX_JSON_BYTES = Number(process.env.MAX_JSON_BYTES || 1_000_000);
const MAX_MEDIA_BYTES = Number(process.env.MAX_MEDIA_BYTES || 25 * 1024 * 1024);
const SESSION_DAYS = Math.min(Math.max(Number(process.env.SESSION_DAYS || 30), 1), 90);
const REGISTER_RATE_LIMIT = Math.min(Math.max(Number(process.env.REGISTER_RATE_LIMIT || 8), 1), 200);
const OWNER_KEY = process.env.CONNECTA_OWNER_KEY || '';
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

await initializeStorage();

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
           when rate_limit_buckets.window_started_at < now() - ($2 || ' seconds')::interval then now()
           else rate_limit_buckets.window_started_at
         end,
         hit_count = case
           when rate_limit_buckets.window_started_at < now() - ($2 || ' seconds')::interval then 1
           else rate_limit_buckets.hit_count + 1
         end
       returning hit_count`,
    [key, String(seconds)],
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
  if (!(await rateLimit(`register:${remoteKey(req)}`, REGISTER_RATE_LIMIT, 3600))) {
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

  const cloneSignal = await scanIdentityClone({ handle, displayName });
  if (cloneSignal) {
    await audit('identity.clone_registration_blocked', null, 'account', cloneSignal.account_id, {
      attemptedHandle: handle,
      attemptedDisplayName: displayName,
      score: cloneSignal.score,
    });
    return send(res, 409, {
      ok: false,
      error: 'This account identity is too similar to a protected CONNECTA account.',
      category: 'account-cloning',
      next: 'Choose a clearly distinct identity or use the legitimate account recovery/verification process.',
    });
  }

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
      await initializeOnboarding(client, accountId);
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
  const validPassword = row && await verifyPassword(body.password || '', row.password_salt, row.password_hash);
  if (!validPassword) return send(res, 401, { ok: false, error: 'Invalid credentials' });

  if (row.status !== 'active') {
    const noticeResult = await query(
      `select id,notice_type,title,body,delivered_at
         from safety_notices where account_id=$1
        order by delivered_at desc limit 1`,
      [row.id],
    );
    return send(res, 423, {
      ok: false,
      blocked: true,
      status: row.status,
      notice: noticeResult.rows[0] || null,
      appealEndpoint: '/v1/safety/appeals',
    });
  }

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

  let where = `p.deleted_at is null and p.moderation_state='allowed' and p.visibility='public'
    and not exists(
      select 1 from safety_blocks sb
      where (sb.blocker_id=$1 and sb.blocked_id=p.author_id)
         or (sb.blocker_id=p.author_id and sb.blocked_id=$1)
    )`;
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
      and not exists(
        select 1 from safety_blocks sb
        where (sb.blocker_id=$1 and sb.blocked_id=p.author_id)
           or (sb.blocker_id=p.author_id and sb.blocked_id=$1)
      )
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
    const category = moderation.categories[0] || 'harassment';
    const enforcement = await automaticViolation({
      accountId: account.id,
      targetType: 'account',
      targetId: account.id,
      category,
      rationale: moderation.reason,
    });
    await audit('post.blocked_before_publish', account.id, 'account', account.id, {
      categories: moderation.categories,
      enforcementCaseId: enforcement.caseId,
    });
    return send(res, 423, {
      ok: false,
      blocked: true,
      moderation,
      enforcement,
      message: 'CONNECTA zero-tolerance safety enforcement has disabled this account.',
    });
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
  if (moderationState === 'allowed') await markMilestone(account.id, 'first_post_at');
  return send(res, 201, { ok: true, post: result, moderation });
}

async function createComment(req, res, account, postId) {
  const body = await readJson(req);
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 4000) : '';
  if (!text) return send(res, 400, { ok: false, error: 'Comment body required' });

  const moderation = moderateText(text);
  if (moderation.action === 'block') {
    const category = moderation.categories[0] || 'harassment';
    const enforcement = await automaticViolation({
      accountId: account.id,
      targetType: 'account',
      targetId: account.id,
      category,
      rationale: moderation.reason,
    });
    return send(res, 423, {
      ok: false,
      blocked: true,
      moderation,
      enforcement,
      message: 'CONNECTA zero-tolerance safety enforcement has disabled this account.',
    });
  }
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
     on conflict do nothing`,
    [account.id, postId, kind],
  );
  return send(res, 200, { ok: true, kind });
}

async function follow(req, res, account, targetId) {
  if (targetId === account.id) return send(res, 400, { ok: false, error: 'Cannot follow yourself' });
  const blocked = await query(
    `select 1 from safety_blocks
      where (blocker_id=$1 and blocked_id=$2) or (blocker_id=$2 and blocked_id=$1)
      limit 1`,
    [account.id, targetId],
  );
  if (blocked.rowCount) return send(res, 403, { ok: false, error: 'Safety block prevents this interaction' });
  await query(
    `insert into follows(follower_id,followed_id) values($1,$2)
     on conflict do nothing`,
    [account.id, targetId],
  );
  await markMilestone(account.id, 'first_follow_at');
  return send(res, 200, { ok: true });
}

async function connect(req, res, account, targetId) {
  if (targetId === account.id) return send(res, 400, { ok: false, error: 'Cannot connect to yourself' });
  const blocked = await query(
    `select 1 from safety_blocks
      where (blocker_id=$1 and blocked_id=$2) or (blocker_id=$2 and blocked_id=$1)
      limit 1`,
    [account.id, targetId],
  );
  if (blocked.rowCount) return send(res, 403, { ok: false, error: 'Safety block prevents this interaction' });
  try {
    await query(
      `insert into connections(requester_id,addressee_id,status)
       values($1,$2,'pending')`,
      [account.id, targetId],
    );
  } catch (error) {
    if (String(error?.code) !== '23505') throw error;
  }
  await markMilestone(account.id, 'first_connection_at');
  return send(res, 200, { ok: true, status: 'pending' });
}

async function reportTarget(req, res, account) {
  if (!(await rateLimit(`report:${account.id}`, 20, 3600))) {
    return send(res, 429, { ok: false, error: 'Report rate limit reached' });
  }

  const body = await readJson(req);
  const allowedTypes = ['account', 'post', 'comment', 'message', 'community', 'media'];
  if (!allowedTypes.includes(body.targetType) || typeof body.targetId !== 'string') {
    return send(res, 400, { ok: false, error: 'Valid targetType and targetId required' });
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 120) : '';
  const detail = typeof body.detail === 'string' ? body.detail.trim().slice(0, 2000) : '';
  if (!reason) return send(res, 400, { ok: false, error: 'Reason required' });

  const result = await safetyReport({
    reporterId: account.id,
    targetType: body.targetType,
    targetId: body.targetId,
    reason,
    detail,
  });
  if (result.error) return send(res, 404, { ok: false, error: result.error });

  await audit('safety.report_lock_applied', account.id, body.targetType, body.targetId, {
    reportId: result.reportId,
    caseId: result.caseId,
    category: result.category,
    duplicate: result.duplicate,
  });

  return send(res, result.duplicate ? 200 : 201, {
    ok: true,
    reportId: result.reportId,
    caseId: result.caseId || null,
    category: result.category,
    protectiveLock: !result.duplicate,
    message: result.duplicate
      ? 'This safety report is already under review.'
      : 'Report accepted. CONNECTA applied an immediate protective safety lock pending urgent review.',
  });
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
    `select id,owner_id,object_key,media_type,mime_type,moderation_state
       from media_assets where id=$1 limit 1`,
    [mediaId],
  );
  const media = result.rows[0];
  if (!media || media.owner_id !== account.id) return send(res, 404, { ok: false, error: 'Media not found' });
  if (media.moderation_state === 'blocked' || media.moderation_state === 'removed') {
    return send(res, 409, { ok: false, error: 'Media cannot be updated' });
  }

  const bytes = await readRaw(req, MAX_MEDIA_BYTES);
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  let fingerprint = null;
  if (media.media_type === 'image' && supportsPerceptualFingerprint(media.mime_type)) {
    try {
      fingerprint = await fingerprintImage(bytes, media.mime_type);
    } catch {
      await query(
        `update media_assets
            set byte_size=$1,sha256=$2,moderation_state='blocked'
          where id=$3`,
        [bytes.length, sha256, mediaId],
      );
      return send(res, 422, {
        ok: false,
        error: 'The uploaded file could not be validated as a supported image.',
      });
    }
  }

  await putMedia(media.object_key, bytes, media.mime_type);

  await query(
    `update media_assets
        set byte_size=$1,sha256=$2,perceptual_hash=$3,moderation_state='review'
      where id=$4`,
    [bytes.length, sha256, fingerprint?.phashPrimary || null, mediaId],
  );

  if (fingerprint) {
    await saveMediaFingerprint({
      mediaId,
      ownerId: account.id,
      fingerprint,
    });
  }

  const duplicate = await duplicateMediaCheck({
    suspectedMediaId: mediaId,
    suspectedOwnerId: account.id,
    sha256,
  });

  const altered = duplicate || !fingerprint
    ? null
    : await perceptualMediaCheck({
        suspectedMediaId: mediaId,
        suspectedOwnerId: account.id,
        fingerprint,
      });

  const copySignal = duplicate || altered;
  const copyKind = duplicate ? 'exact-file' : altered ? 'altered-image' : null;

  await query(
    `insert into moderation_cases(source,target_type,target_id,category,severity,state,rationale)
     values('automatic','media',$1,$2,$3,'open',$4)`,
    [
      mediaId,
      copySignal ? 'possible-content-copy' : 'media-review-required',
      copySignal ? 4 : 2,
      duplicate
        ? 'Exact-file match to media previously uploaded by another account; earlier uploader alerted and review required.'
        : altered
          ? 'High-confidence perceptual image match detected after normalisation/crop analysis; earlier uploader alerted and review required.'
          : 'Uploaded media requires review before public distribution',
    ],
  );

  return send(res, 200, {
    ok: true,
    media: {
      id: mediaId,
      byteSize: bytes.length,
      sha256,
      perceptualHash: fingerprint?.phashPrimary || null,
      state: 'review',
    },
    duplicateOwnerAlert: Boolean(duplicate),
    alteredCopyOwnerAlert: Boolean(altered),
    copySignal: copyKind,
  });
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
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';

  if (body.action === 'none' || body.action === 'clear' || body.action === 'reverse') {
    const result = await clearSafetyCase(caseId, 'owner', note);
    if (!result) return send(res, 404, { ok: false, error: 'Moderation case not found' });
    return send(res, 200, { ok: true, state: 'cleared', action: 'none', ...result });
  }

  const result = await confirmViolation(caseId, 'owner', note);
  if (!result) return send(res, 404, { ok: false, error: 'Moderation case not found' });
  return send(res, 200, {
    ok: true,
    state: 'actioned',
    action: 'disable',
    ...result,
    message: 'Confirmed violation: account disabled and formal safety/legal compliance warning issued.',
  });
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
  const bytes = await getMedia(media.object_key).catch(() => null);
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
    const storage = await storageHealth().then(() => 'ok').catch(() => 'error');
    const healthy = database === 'ok' && storage === 'ok';
    return send(res, healthy ? 200 : 503, {
      ok: healthy,
      service: 'CONNECTA ENGINE',
      version: ENGINE_VERSION,
      instance: ENGINE_INSTANCE,
      database,
      storage,
      storageAdapter: storageInfo(),
      providerIndependent: true,
      productEngine: 'CONNECTA',
      dependsOnAnotherProductEngine: false,
      externalServicesReplaceableAdaptersOnly: true,
      behaviouralTracking: false,
    });
  }

  if (req.method === 'POST' && url.pathname === '/v1/auth/register') return register(req, res);
  if (req.method === 'POST' && url.pathname === '/v1/auth/login') return login(req, res);

  const publicBusinessMatch = url.pathname.match(/^\/v1\/businesses\/([0-9a-f-]+)$/i);
  if (req.method === 'GET' && publicBusinessMatch) {
    const business = await publicBusiness(publicBusinessMatch[1]);
    if (!business) return send(res, 404, { ok: false, error: 'Verified business not found' });
    return send(res, 200, { ok: true, business, verified: true });
  }
  if (req.method === 'POST' && url.pathname === '/v1/safety/appeals') {
    if (!(await rateLimit(`appeal:${remoteKey(req)}`, 10, 3600))) {
      return send(res, 429, { ok: false, error: 'Appeal rate limit reached' });
    }
    const b = await readJson(req);
    const email = normalizeEmail(b.email);
    const statement = typeof b.statement === 'string' ? b.statement.trim().slice(0, 4000) : '';
    const caseId = typeof b.caseId === 'string' ? b.caseId : '';
    if (!email || !caseId || !statement) return send(res, 400, { ok: false, error: 'Email, caseId and statement are required' });
    const auth = await query(
      `select a.id,c.password_salt,c.password_hash
         from accounts a join password_credentials c on c.account_id=a.id
        where lower(a.email)=lower($1) limit 1`,
      [email],
    );
    const row = auth.rows[0];
    const verified = row && await verifyPassword(b.password || '', row.password_salt, row.password_hash);
    if (!verified) return send(res, 401, { ok: false, error: 'Invalid credentials' });
    const enforcement = await query(
      'select 1 from account_enforcements where account_id=$1 and moderation_case_id=$2 limit 1',
      [row.id, caseId],
    );
    if (!enforcement.rowCount) return send(res, 404, { ok: false, error: 'Safety case not found for this account' });
    const appeal = await query(
      `insert into appeals(moderation_case_id,appellant_id,statement)
       values($1,$2,$3) returning id,state,created_at`,
      [caseId, row.id, statement],
    );
    await audit('safety.appeal_submitted', row.id, 'account', row.id, { caseId, appealId: appeal.rows[0].id });
    return send(res, 201, { ok: true, appeal: appeal.rows[0] });
  }

  if (req.method === 'GET' && url.pathname === '/v1/admin/moderation') return moderationQueue(req, res);
  if (req.method === 'GET' && url.pathname === '/v1/admin/growth') {
    if (!requireOwner(req, res)) return;
    return growthSummary((status, data) => send(res, status, data));
  }
  if (req.method === 'GET' && url.pathname === '/v1/admin/identity-alerts') {
    if (!requireOwner(req, res)) return;
    return send(res, 200, { ok: true, alerts: await listIdentityAlerts() });
  }
  if (req.method === 'GET' && url.pathname === '/v1/admin/business-verifications') {
    if (!requireOwner(req, res)) return;
    return send(res, 200, { ok: true, businesses: await listBusinessVerifications() });
  }
  const businessEvidenceDecisionMatch = url.pathname.match(/^\/v1\/admin\/businesses\/([0-9a-f-]+)\/evidence\/([0-9a-f-]+)$/i);
  if (req.method === 'PATCH' && businessEvidenceDecisionMatch) {
    if (!requireOwner(req, res)) return;
    const body = await readJson(req);
    const result = await decideBusinessEvidence({
      businessId: businessEvidenceDecisionMatch[1],
      evidenceId: businessEvidenceDecisionMatch[2],
      action: typeof body.action === 'string' ? body.action : '',
      reviewer: 'owner',
      note: typeof body.note === 'string' ? body.note : '',
    });
    if (result.error) return send(res, 400, { ok: false, error: result.error });
    return send(res, 200, { ok: true, ...result });
  }
  const businessDecisionMatch = url.pathname.match(/^\/v1\/admin\/businesses\/([0-9a-f-]+)\/verification$/i);
  if (req.method === 'PATCH' && businessDecisionMatch) {
    if (!requireOwner(req, res)) return;
    const body = await readJson(req);
    const action = typeof body.action === 'string' ? body.action : '';
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
    const result = await decideBusinessVerification({
      businessId: businessDecisionMatch[1],
      action,
      reviewer: 'owner',
      note,
    });
    if (result.error) return send(res, 400, { ok: false, error: result.error });
    return send(res, 200, { ok: true, ...result });
  }
  const identityProtect = url.pathname.match(/^\/v1\/admin\/identities\/([0-9a-f-]+)\/protect$/i);
  if (req.method === 'POST' && identityProtect) {
    if (!requireOwner(req, res)) return;
    const result = await protectIdentity(identityProtect[1], 'verified');
    if (!result) return send(res, 404, { ok: false, error: 'Account not found' });
    await audit('identity.protected', null, 'account', identityProtect[1], { verificationState: 'verified' });
    return send(res, 200, { ok: true, identity: result });
  }
  const adminCase = url.pathname.match(/^\/v1\/admin\/moderation\/([0-9a-f-]+)$/i);
  if (req.method === 'PATCH' && adminCase) return resolveModeration(req, res, adminCase[1]);

  const account = await requireAccount(req, res);
  if (!account) return;

  if (req.method === 'POST' && url.pathname === '/v1/auth/logout') {
    await query('update sessions set revoked_at=now() where token_hash=$1', [account.tokenHash]);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/v1/me') return send(res, 200, { ok: true, account });
  if (req.method === 'GET' && url.pathname === '/v1/me/notices') {
    return send(res, 200, { ok: true, notices: await listSafetyNotices(account.id) });
  }
  if (req.method === 'GET' && url.pathname === '/v1/notifications') {
    return send(res, 200, { ok: true, notifications: await listNotifications(account.id) });
  }
  const notificationReadMatch = url.pathname.match(/^\/v1\/notifications\/([0-9a-f-]+)\/read$/i);
  if (req.method === 'POST' && notificationReadMatch) {
    const notification = await markNotificationRead(account.id, notificationReadMatch[1]);
    if (!notification) return send(res, 404, { ok: false, error: 'Notification not found' });
    return send(res, 200, { ok: true, notification });
  }
  if (req.method === 'POST' && url.pathname === '/v1/businesses/apply') {
    const body = await readJson(req);
    const result = await submitBusinessVerification(account.id, body);
    if (result.error) return send(res, 400, { ok: false, error: result.error });
    return send(res, 201, { ok: true, ...result, verified: false });
  }
  const businessEvidenceMatch = url.pathname.match(/^\/v1\/businesses\/([0-9a-f-]+)\/evidence$/i);
  if (req.method === 'POST' && businessEvidenceMatch) {
    const body = await readJson(req);
    const result = await addBusinessEvidence(account.id, businessEvidenceMatch[1], body);
    if (result.error) return send(res, 400, { ok: false, error: result.error });
    return send(res, 201, { ok: true, ...result });
  }
  if (req.method === 'GET' && url.pathname === '/v1/feed') return feed(req, res, account);
  if (req.method === 'POST' && url.pathname === '/v1/posts') return createPost(req, res, account);
  if (req.method === 'POST' && url.pathname === '/v1/reports') return reportTarget(req, res, account);
  if (req.method === 'POST' && url.pathname === '/v1/shares') {
    const body = await readJson(req);
    const sourceType = typeof body.sourceType === 'string' ? body.sourceType : '';
    const sourceId = typeof body.sourceId === 'string' ? body.sourceId : '';
    const commentary = typeof body.commentary === 'string' ? body.commentary.trim().slice(0, 1000) : '';
    if (!sourceId) return send(res, 400, { ok: false, error: 'sourceId required' });
    if (commentary) {
      const moderation = moderateText(commentary);
      if (moderation.action === 'block') {
        const enforcement = await automaticViolation({
          accountId: account.id,
          targetType: 'account',
          targetId: account.id,
          category: moderation.categories[0] || 'harassment',
          rationale: moderation.reason,
        });
        return send(res, 423, { ok: false, blocked: true, moderation, enforcement });
      }
      if (moderation.action === 'review') {
        return send(res, 422, { ok: false, error: 'Share commentary requires review before publishing', moderation });
      }
    }
    const result = await shareContent({
      sharerId: account.id,
      sourceType,
      sourceId,
      commentary,
    });
    if (result.error) return send(res, 400, { ok: false, error: result.error });
    await audit('content.shared', account.id, sourceType, sourceId, { originalOwnerId: result.originalOwnerId });
    return send(res, 201, { ok: true, ...result, ownerAlerted: true });
  }
  if (req.method === 'POST' && url.pathname === '/v1/media') return createMedia(req, res, account);
  if (req.method === 'POST' && url.pathname === '/v1/invites') {
    const body = await readJson(req);
    return createInvite((status, data) => send(res, status, data), account, body);
  }
  if (req.method === 'GET' && url.pathname === '/v1/invites') {
    return listInvites((status, data) => send(res, status, data), account);
  }
  if (req.method === 'POST' && url.pathname === '/v1/communities') {
    const body = await readJson(req);
    return createCommunity((status, data) => send(res, status, data), account, body);
  }
  if (req.method === 'GET' && url.pathname === '/v1/communities/discover') {
    return discoverCommunities(
      (status, data) => send(res, status, data),
      account,
      url.searchParams.get('limit'),
    );
  }

  const postComment = url.pathname.match(/^\/v1\/posts\/([0-9a-f-]+)\/comments$/i);
  if (req.method === 'POST' && postComment) return createComment(req, res, account, postComment[1]);

  const postReaction = url.pathname.match(/^\/v1\/posts\/([0-9a-f-]+)\/reactions$/i);
  if (req.method === 'POST' && postReaction) return react(req, res, account, postReaction[1]);

  const followMatch = url.pathname.match(/^\/v1\/follows\/([0-9a-f-]+)$/i);
  if (req.method === 'POST' && followMatch) return follow(req, res, account, followMatch[1]);

  const connectionMatch = url.pathname.match(/^\/v1\/connections\/([0-9a-f-]+)$/i);
  if (req.method === 'POST' && connectionMatch) return connect(req, res, account, connectionMatch[1]);

  const inviteRedeem = url.pathname.match(/^\/v1\/invites\/([^/]+)\/redeem$/);
  if (req.method === 'POST' && inviteRedeem) {
    return redeemInvite((status, data) => send(res, status, data), account, inviteRedeem[1]);
  }

  const communityJoin = url.pathname.match(/^\/v1\/communities\/([0-9a-f-]+)\/join$/i);
  if (req.method === 'POST' && communityJoin) {
    return joinCommunity((status, data) => send(res, status, data), account, communityJoin[1]);
  }

  const communityInvite = url.pathname.match(/^\/v1\/communities\/([0-9a-f-]+)\/invites$/i);
  if (req.method === 'POST' && communityInvite) {
    const body = await readJson(req);
    return createCommunityInvite(
      (status, data) => send(res, status, data),
      account,
      communityInvite[1],
      body,
    );
  }

  const communityInviteRedeem = url.pathname.match(/^\/v1\/community-invites\/([^/]+)\/redeem$/);
  if (req.method === 'POST' && communityInviteRedeem) {
    return redeemCommunityInvite(
      (status, data) => send(res, status, data),
      account,
      communityInviteRedeem[1],
    );
  }

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
