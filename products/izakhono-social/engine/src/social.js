import { query, transaction } from './db.js';
import { moderateText } from './moderation.js';

function safeLimit(value, fallback = 30, max = 100) {
  return Math.min(Math.max(Number(value || fallback), 1), max);
}

async function blockedBetween(first, second) {
  const result = await query(
    `select 1 from safety_blocks
      where (blocker_id=$1 and blocked_id=$2)
         or (blocker_id=$2 and blocked_id=$1)
      limit 1`,
    [first, second],
  );
  return Boolean(result.rowCount);
}

async function notify({ accountId, kind, actorId = null, targetType = null, targetId = null, title, body }) {
  if (!accountId || accountId === actorId) return;
  await query(
    `insert into notifications(account_id,kind,actor_id,target_type,target_id,title,body)
     values($1,$2,$3,$4,$5,$6,$7)`,
    [accountId, kind, actorId, targetType, targetId, title, body],
  );
}

const postSelect = (viewerParam = '$1') => `
  p.id,p.author_id,p.body,p.visibility,p.created_at,p.updated_at,p.community_id,
  pr.handle,pr.display_name,pr.avatar_key,pr.bio,
  exists(select 1 from businesses b where b.owner_id=p.author_id and b.verification_state='verified') as verified,
  (select count(*)::int from comments c where c.post_id=p.id and c.deleted_at is null and c.moderation_state='allowed') as reply_count,
  (select count(*)::int from reactions r where r.post_id=p.id) as reaction_count,
  (select count(*)::int from post_reposts rr where rr.post_id=p.id) as repost_count,
  exists(select 1 from reactions vr where vr.post_id=p.id and vr.actor_id=${viewerParam}) as viewer_reacted,
  exists(select 1 from bookmarks vb where vb.post_id=p.id and vb.account_id=${viewerParam}) as viewer_bookmarked,
  exists(select 1 from post_reposts vrr where vrr.post_id=p.id and vrr.actor_id=${viewerParam}) as viewer_reposted,
  exists(select 1 from follows vf where vf.followed_id=p.author_id and vf.follower_id=${viewerParam}) as viewer_following
`;

export async function postById(accountId, postId) {
  const result = await query(
    `select ${postSelect('$1')}
       from posts p
       join profiles pr on pr.account_id=p.author_id
      where p.id=$2
        and p.deleted_at is null
        and p.moderation_state='allowed'
        and p.visibility='public'
        and not exists(
          select 1 from safety_blocks sb
          where (sb.blocker_id=$1 and sb.blocked_id=p.author_id)
             or (sb.blocker_id=p.author_id and sb.blocked_id=$1)
        )
      limit 1`,
    [accountId, postId],
  );
  return result.rows[0] || null;
}

export async function listComments(accountId, postId, limit = 100) {
  const result = await query(
    `select c.id,c.post_id,c.author_id,c.parent_comment_id,c.body,c.created_at,c.updated_at,
            pr.handle,pr.display_name,pr.avatar_key,
            exists(select 1 from businesses b where b.owner_id=c.author_id and b.verification_state='verified') as verified,
            (select count(*)::int from reactions r where r.comment_id=c.id) as reaction_count,
            exists(select 1 from reactions vr where vr.comment_id=c.id and vr.actor_id=$1) as viewer_reacted
       from comments c
       join profiles pr on pr.account_id=c.author_id
      where c.post_id=$2
        and c.deleted_at is null
        and c.moderation_state='allowed'
        and not exists(
          select 1 from safety_blocks sb
          where (sb.blocker_id=$1 and sb.blocked_id=c.author_id)
             or (sb.blocker_id=c.author_id and sb.blocked_id=$1)
        )
      order by c.created_at asc
      limit $3`,
    [accountId, postId, safeLimit(limit, 100, 250)],
  );
  return result.rows;
}

export async function togglePostReaction(account, postId, kind = 'appreciate') {
  const allowed = new Set(['appreciate', 'support', 'celebrate', 'insightful']);
  const selected = allowed.has(kind) ? kind : 'appreciate';
  const target = await query(
    `select p.author_id,pr.handle,pr.display_name
       from posts p join profiles pr on pr.account_id=p.author_id
      where p.id=$1 and p.deleted_at is null and p.moderation_state='allowed'
      limit 1`,
    [postId],
  );
  if (!target.rowCount) return { error: 'Post not found' };
  if (await blockedBetween(account.id, target.rows[0].author_id)) return { error: 'Safety block prevents this interaction' };

  return transaction(async (client) => {
    const existing = await client.query(
      'select kind from reactions where actor_id=$1 and post_id=$2 and comment_id is null limit 1',
      [account.id, postId],
    );
    if (existing.rowCount) {
      await client.query(
        'delete from reactions where actor_id=$1 and post_id=$2 and comment_id is null',
        [account.id, postId],
      );
      return { reacted: false, kind: null };
    }
    await client.query(
      'insert into reactions(actor_id,post_id,kind) values($1,$2,$3)',
      [account.id, postId, selected],
    );
    if (target.rows[0].author_id !== account.id) {
      await client.query(
        `insert into notifications(account_id,kind,actor_id,target_type,target_id,title,body)
         values($1,'reaction',$2,'post',$3,$4,$5)`,
        [
          target.rows[0].author_id,
          account.id,
          postId,
          '@' + account.handle + ' reacted to your post',
          (account.display_name || account.handle) + ' reacted to your post on CONNECTA.',
        ],
      );
    }
    return { reacted: true, kind: selected };
  });
}

export async function toggleBookmark(accountId, postId) {
  return transaction(async (client) => {
    const post = await client.query(
      `select id from posts where id=$1 and deleted_at is null and moderation_state='allowed' limit 1`,
      [postId],
    );
    if (!post.rowCount) return { error: 'Post not found' };
    const existing = await client.query(
      'select 1 from bookmarks where account_id=$1 and post_id=$2',
      [accountId, postId],
    );
    if (existing.rowCount) {
      await client.query('delete from bookmarks where account_id=$1 and post_id=$2', [accountId, postId]);
      return { bookmarked: false };
    }
    await client.query('insert into bookmarks(account_id,post_id) values($1,$2)', [accountId, postId]);
    return { bookmarked: true };
  });
}

export async function listBookmarks(accountId, limit = 100) {
  const result = await query(
    `select ${postSelect('$1')}, b.created_at as bookmarked_at
       from bookmarks b
       join posts p on p.id=b.post_id
       join profiles pr on pr.account_id=p.author_id
      where b.account_id=$1
        and p.deleted_at is null
        and p.moderation_state='allowed'
        and p.visibility='public'
        and not exists(
          select 1 from safety_blocks sb
          where (sb.blocker_id=$1 and sb.blocked_id=p.author_id)
             or (sb.blocker_id=p.author_id and sb.blocked_id=$1)
        )
      order by b.created_at desc
      limit $2`,
    [accountId, safeLimit(limit, 100, 200)],
  );
  return result.rows;
}

export async function toggleRepost(account, postId) {
  const target = await query(
    `select p.author_id,pr.display_name,pr.handle
       from posts p join profiles pr on pr.account_id=p.author_id
      where p.id=$1 and p.deleted_at is null and p.moderation_state='allowed' and p.visibility='public'
      limit 1`,
    [postId],
  );
  if (!target.rowCount) return { error: 'Post not found' };
  if (target.rows[0].author_id === account.id) return { error: 'You already own this post' };
  if (await blockedBetween(account.id, target.rows[0].author_id)) return { error: 'Safety block prevents this interaction' };

  return transaction(async (client) => {
    const existing = await client.query(
      'select 1 from post_reposts where actor_id=$1 and post_id=$2',
      [account.id, postId],
    );
    if (existing.rowCount) {
      await client.query('delete from post_reposts where actor_id=$1 and post_id=$2', [account.id, postId]);
      return { reposted: false };
    }
    await client.query(
      'insert into post_reposts(actor_id,post_id) values($1,$2)',
      [account.id, postId],
    );
    await client.query(
      `insert into notifications(account_id,kind,actor_id,target_type,target_id,title,body)
       values($1,'content_shared',$2,'post',$3,$4,$5)`,
      [
        target.rows[0].author_id,
        account.id,
        postId,
        '@' + account.handle + ' reposted your post',
        (account.display_name || account.handle) + ' reposted your post with original attribution preserved.',
      ],
    );
    return { reposted: true };
  });
}

export async function toggleFollow(account, targetId) {
  if (account.id === targetId) return { error: 'Cannot follow yourself' };
  if (await blockedBetween(account.id, targetId)) return { error: 'Safety block prevents this interaction' };
  const target = await query(
    `select a.id,p.handle,p.display_name from accounts a join profiles p on p.account_id=a.id
      where a.id=$1 and a.status='active' limit 1`,
    [targetId],
  );
  if (!target.rowCount) return { error: 'Account not found' };

  return transaction(async (client) => {
    const existing = await client.query(
      'select 1 from follows where follower_id=$1 and followed_id=$2',
      [account.id, targetId],
    );
    if (existing.rowCount) {
      await client.query('delete from follows where follower_id=$1 and followed_id=$2', [account.id, targetId]);
      return { following: false };
    }
    await client.query('insert into follows(follower_id,followed_id) values($1,$2)', [account.id, targetId]);
    await client.query(
      `insert into notifications(account_id,kind,actor_id,target_type,target_id,title,body)
       values($1,'follow',$2,'account',$2,$3,$4)`,
      [
        targetId,
        account.id,
        '@' + account.handle + ' followed you',
        (account.display_name || account.handle) + ' is now following you on CONNECTA.',
      ],
    );
    return { following: true };
  });
}

export async function profileByHandle(viewerId, handle) {
  const result = await query(
    `select a.id,p.handle,p.display_name,p.bio,p.avatar_key,p.cover_key,p.city,p.country_code,p.website,p.location,p.created_at,
            exists(select 1 from businesses b where b.owner_id=a.id and b.verification_state='verified') as verified,
            (select count(*)::int from follows f where f.followed_id=a.id) as follower_count,
            (select count(*)::int from follows f where f.follower_id=a.id) as following_count,
            exists(select 1 from follows f where f.follower_id=$1 and f.followed_id=a.id) as viewer_following
       from accounts a
       join profiles p on p.account_id=a.id
      where lower(p.handle)=lower($2)
        and a.status='active'
        and p.discoverable=true
        and not exists(
          select 1 from safety_blocks sb
          where (sb.blocker_id=$1 and sb.blocked_id=a.id)
             or (sb.blocker_id=a.id and sb.blocked_id=$1)
        )
      limit 1`,
    [viewerId, String(handle || '').replace(/^@/, '').slice(0, 40)],
  );
  if (!result.rowCount) return null;
  const profile = result.rows[0];
  const posts = await query(
    `select ${postSelect('$1')}
       from posts p
       join profiles pr on pr.account_id=p.author_id
      where p.author_id=$2
        and p.deleted_at is null
        and p.moderation_state='allowed'
        and p.visibility='public'
      order by p.created_at desc
      limit 60`,
    [viewerId, profile.id],
  );
  return { profile, posts: posts.rows };
}

export async function updateProfile(accountId, body = {}) {
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 100) : null;
  const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 500) : null;
  const city = typeof body.city === 'string' ? body.city.trim().slice(0, 100) : null;
  const countryCode = typeof body.countryCode === 'string'
    ? body.countryCode.trim().toUpperCase().slice(0, 2)
    : null;
  const website = typeof body.website === 'string' ? body.website.trim().slice(0, 500) : null;
  const location = typeof body.location === 'string' ? body.location.trim().slice(0, 120) : null;
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) return { error: 'countryCode must be two letters' };

  const result = await query(
    `update profiles set
       display_name=coalesce($2,display_name),
       bio=coalesce($3,bio),
       city=coalesce($4,city),
       country_code=coalesce($5,country_code),
       website=coalesce($6,website),
       location=coalesce($7,location),
       updated_at=now()
     where account_id=$1
     returning account_id,handle,display_name,bio,avatar_key,cover_key,city,country_code,website,location,visibility,discoverable`,
    [accountId, displayName, bio, city, countryCode, website, location],
  );
  return { profile: result.rows[0] || null };
}

export async function searchNetwork(accountId, term, limit = 30) {
  const q = String(term || '').trim().slice(0, 120);
  if (!q) return { profiles: [], posts: [] };
  const pattern = '%' + q.replace(/^[@#]/, '') + '%';
  const safe = safeLimit(limit, 30, 60);
  const [profiles, posts] = await Promise.all([
    query(
      `select a.id,p.handle,p.display_name,p.bio,p.avatar_key,
              exists(select 1 from businesses b where b.owner_id=a.id and b.verification_state='verified') as verified,
              (select count(*)::int from follows f where f.followed_id=a.id) as follower_count,
              exists(select 1 from follows f where f.follower_id=$1 and f.followed_id=a.id) as viewer_following
         from accounts a join profiles p on p.account_id=a.id
        where a.status='active' and p.discoverable=true
          and (p.handle ilike $2 or p.display_name ilike $2 or p.bio ilike $2)
          and not exists(
            select 1 from safety_blocks sb
            where (sb.blocker_id=$1 and sb.blocked_id=a.id)
               or (sb.blocker_id=a.id and sb.blocked_id=$1)
          )
        order by follower_count desc,p.created_at desc
        limit $3`,
      [accountId, pattern, safe],
    ),
    query(
      `select ${postSelect('$1')}
         from posts p join profiles pr on pr.account_id=p.author_id
        where p.deleted_at is null and p.moderation_state='allowed' and p.visibility='public'
          and p.body ilike $2
          and not exists(
            select 1 from safety_blocks sb
            where (sb.blocker_id=$1 and sb.blocked_id=p.author_id)
               or (sb.blocker_id=p.author_id and sb.blocked_id=$1)
          )
        order by p.created_at desc
        limit $3`,
      [accountId, '%' + q + '%', safe],
    ),
  ]);
  return { profiles: profiles.rows, posts: posts.rows };
}

export async function suggestions(accountId, limit = 8) {
  const result = await query(
    `select a.id,p.handle,p.display_name,p.bio,p.avatar_key,
            exists(select 1 from businesses b where b.owner_id=a.id and b.verification_state='verified') as verified,
            (select count(*)::int from follows f where f.followed_id=a.id) as follower_count
       from accounts a join profiles p on p.account_id=a.id
      where a.id<>$1 and a.status='active' and p.discoverable=true
        and not exists(select 1 from follows f where f.follower_id=$1 and f.followed_id=a.id)
        and not exists(
          select 1 from safety_blocks sb
          where (sb.blocker_id=$1 and sb.blocked_id=a.id)
             or (sb.blocker_id=a.id and sb.blocked_id=$1)
        )
      order by follower_count desc,p.created_at desc
      limit $2`,
    [accountId, safeLimit(limit, 8, 30)],
  );
  return result.rows;
}

export async function trends(limit = 10) {
  const recent = await query(
    `select body,created_at from posts
      where deleted_at is null and moderation_state='allowed' and visibility='public'
        and created_at >= now()-interval '7 days'
      order by created_at desc
      limit 1500`,
  );
  const counts = new Map();
  for (const row of recent.rows) {
    const tags = String(row.body || '').match(/#[\p{L}\p{N}_-]+/gu) || [];
    for (const raw of new Set(tags)) {
      const key = raw.toLocaleLowerCase();
      const current = counts.get(key) || { tag: raw, count: 0, latest: row.created_at };
      current.count += 1;
      if (new Date(row.created_at) > new Date(current.latest)) current.latest = row.created_at;
      counts.set(key, current);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || new Date(b.latest) - new Date(a.latest))
    .slice(0, safeLimit(limit, 10, 20));
}

export async function listConversations(accountId, limit = 50) {
  const result = await query(
    `select c.id,c.kind,c.title,c.created_at,c.updated_at,
            coalesce(json_agg(json_build_object(
              'id',a.id,'handle',p.handle,'display_name',p.display_name,'avatar_key',p.avatar_key
            ) order by p.display_name) filter (where a.id is not null),'[]') as members,
            (
              select m.body from messages m
              where m.conversation_id=c.id and m.deleted_at is null and m.moderation_state='allowed'
              order by m.created_at desc limit 1
            ) as last_message,
            (
              select m.created_at from messages m
              where m.conversation_id=c.id and m.deleted_at is null and m.moderation_state='allowed'
              order by m.created_at desc limit 1
            ) as last_message_at
       from conversations c
       join conversation_members mine on mine.conversation_id=c.id and mine.account_id=$1 and mine.left_at is null
       join conversation_members cm on cm.conversation_id=c.id and cm.left_at is null
       join accounts a on a.id=cm.account_id
       join profiles p on p.account_id=a.id
      group by c.id
      order by coalesce((
        select max(m.created_at) from messages m where m.conversation_id=c.id and m.deleted_at is null
      ),c.updated_at,c.created_at) desc
      limit $2`,
    [accountId, safeLimit(limit, 50, 100)],
  );
  return result.rows;
}

export async function createDirectConversation(account, targetHandle) {
  const target = await query(
    `select a.id,p.handle,p.display_name
       from accounts a join profiles p on p.account_id=a.id
      where lower(p.handle)=lower($1) and a.status='active' limit 1`,
    [String(targetHandle || '').replace(/^@/, '').slice(0, 40)],
  );
  if (!target.rowCount) return { error: 'Recipient not found' };
  const other = target.rows[0];
  if (other.id === account.id) return { error: 'Choose another member' };
  if (await blockedBetween(account.id, other.id)) return { error: 'Safety block prevents this conversation' };

  const existing = await query(
    `select c.id,c.kind,c.title,c.created_at,c.updated_at
       from conversations c
      where c.kind='direct'
        and exists(select 1 from conversation_members cm where cm.conversation_id=c.id and cm.account_id=$1 and cm.left_at is null)
        and exists(select 1 from conversation_members cm where cm.conversation_id=c.id and cm.account_id=$2 and cm.left_at is null)
        and (select count(*) from conversation_members cm where cm.conversation_id=c.id and cm.left_at is null)=2
      limit 1`,
    [account.id, other.id],
  );
  if (existing.rowCount) return { conversation: existing.rows[0], recipient: other, existing: true };

  const created = await transaction(async (client) => {
    const conversation = await client.query(
      `insert into conversations(kind,updated_at) values('direct',now())
       returning id,kind,title,created_at,updated_at`,
    );
    const item = conversation.rows[0];
    await client.query(
      `insert into conversation_members(conversation_id,account_id,role)
       values($1,$2,'admin'),($1,$3,'member')`,
      [item.id, account.id, other.id],
    );
    return item;
  });
  return { conversation: created, recipient: other, existing: false };
}

export async function listMessages(accountId, conversationId, limit = 200) {
  const membership = await query(
    'select 1 from conversation_members where conversation_id=$1 and account_id=$2 and left_at is null limit 1',
    [conversationId, accountId],
  );
  if (!membership.rowCount) return { error: 'Conversation not found' };
  const result = await query(
    `select m.id,m.conversation_id,m.sender_id,m.body,m.created_at,
            p.handle,p.display_name,p.avatar_key
       from messages m join profiles p on p.account_id=m.sender_id
      where m.conversation_id=$1
        and m.deleted_at is null
        and m.moderation_state='allowed'
      order by m.created_at asc
      limit $2`,
    [conversationId, safeLimit(limit, 200, 500)],
  );
  await query(
    'update conversation_members set last_read_at=now() where conversation_id=$1 and account_id=$2',
    [conversationId, accountId],
  );
  return { messages: result.rows };
}

export async function sendMessage(account, conversationId, rawBody) {
  const body = String(rawBody || '').trim().slice(0, 8000);
  if (!body) return { error: 'Message body required' };
  const members = await query(
    `select cm.account_id,p.handle,p.display_name
       from conversation_members cm
       join profiles p on p.account_id=cm.account_id
      where cm.conversation_id=$1 and cm.left_at is null`,
    [conversationId],
  );
  if (!members.rows.some((member) => member.account_id === account.id)) return { error: 'Conversation not found' };
  for (const member of members.rows) {
    if (member.account_id !== account.id && await blockedBetween(account.id, member.account_id)) {
      return { error: 'Safety block prevents this message' };
    }
  }
  const moderation = moderateText(body);
  if (moderation.action === 'block') return { error: 'Message blocked by safety controls', blocked: true, moderation };
  if (moderation.action === 'review') return { error: 'Message requires review before delivery', review: true, moderation };

  const result = await transaction(async (client) => {
    const inserted = await client.query(
      `insert into messages(conversation_id,sender_id,body,moderation_state)
       values($1,$2,$3,'allowed')
       returning id,conversation_id,sender_id,body,created_at`,
      [conversationId, account.id, body],
    );
    await client.query('update conversations set updated_at=now() where id=$1', [conversationId]);
    for (const member of members.rows) {
      if (member.account_id === account.id) continue;
      await client.query(
        `insert into notifications(account_id,kind,actor_id,target_type,target_id,title,body)
         values($1,'message',$2,'message',$3,$4,$5)`,
        [
          member.account_id,
          account.id,
          inserted.rows[0].id,
          'New message from @' + account.handle,
          body.slice(0, 180),
        ],
      );
    }
    return inserted.rows[0];
  });
  return { message: result };
}
