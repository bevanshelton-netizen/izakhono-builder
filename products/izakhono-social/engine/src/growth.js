import { randomBytes } from 'node:crypto';
import { query, transaction } from './db.js';

const MILESTONE_COLUMNS = new Set([
  'first_connection_at',
  'first_follow_at',
  'first_community_at',
  'first_post_at',
  'first_invite_at',
]);

function code(prefix = 'C') {
  return `${prefix}-${randomBytes(6).toString('base64url').toUpperCase()}`;
}

function validSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 60;
}

export async function initializeOnboarding(client, accountId) {
  await client.query(
    `insert into onboarding_state(account_id,profile_complete)
     values($1,true)
     on conflict(account_id) do update
       set profile_complete=true,updated_at=now()`,
    [accountId],
  );
}

export async function markMilestone(accountId, column) {
  if (!MILESTONE_COLUMNS.has(column)) return;

  await query(
    `insert into onboarding_state(account_id,${column})
     values($1,now())
     on conflict(account_id) do update set
       ${column}=coalesce(onboarding_state.${column},now()),
       updated_at=now()`,
    [accountId],
  );

  await query(
    `update onboarding_state
        set activated_at=coalesce(activated_at,now()),updated_at=now()
      where account_id=$1
        and profile_complete=true
        and first_post_at is not null
        and (
          first_connection_at is not null
          or first_follow_at is not null
          or first_community_at is not null
        )`,
    [accountId],
  );
}

export async function createInvite(respond, account, body = {}) {
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 80) : '';
  const maxUses = Number.isInteger(body.maxUses)
    ? Math.min(Math.max(body.maxUses, 1), 10000)
    : null;
  const days = Number.isInteger(body.expiresInDays)
    ? Math.min(Math.max(body.expiresInDays, 1), 365)
    : 30;

  let created;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const inviteCode = code('C');
    try {
      const result = await query(
        `insert into invite_codes(owner_id,code,label,max_uses,expires_at)
         values($1,$2,$3,$4,now()+($5 || ' days')::interval)
         returning id,code,label,max_uses,use_count,expires_at,created_at`,
        [account.id, inviteCode, label, maxUses, String(days)],
      );
      created = result.rows[0];
      break;
    } catch (error) {
      if (String(error?.code) !== '23505' || attempt === 3) throw error;
    }
  }

  await markMilestone(account.id, 'first_invite_at');
  return respond(201, { ok: true, invite: created });
}

export async function listInvites(respond, account) {
  const result = await query(
    `select id,code,label,max_uses,use_count,expires_at,active,created_at
       from invite_codes
      where owner_id=$1
      order by created_at desc
      limit 100`,
    [account.id],
  );
  return respond(200, { ok: true, invites: result.rows });
}

export async function redeemInvite(respond, account, inviteCode) {
  const normalized = String(inviteCode || '').trim().toUpperCase();
  if (!normalized) return respond(400, { ok: false, error: 'Invite code required' });

  const outcome = await transaction(async (client) => {
    const invite = await client.query(
      `select * from invite_codes
        where code=$1 and active=true
          and (expires_at is null or expires_at > now())
          and (max_uses is null or use_count < max_uses)
        for update`,
      [normalized],
    );
    if (!invite.rowCount) return { error: 'Invite code is invalid or expired' };

    const already = await client.query(
      'select 1 from invite_redemptions where invited_account_id=$1',
      [account.id],
    );
    if (already.rowCount) return { error: 'This account has already redeemed an invite' };

    await client.query(
      'insert into invite_redemptions(invite_id,invited_account_id) values($1,$2)',
      [invite.rows[0].id, account.id],
    );
    await client.query(
      'update invite_codes set use_count=use_count+1 where id=$1',
      [invite.rows[0].id],
    );
    return { inviterId: invite.rows[0].owner_id };
  });

  if (outcome.error) return respond(409, { ok: false, error: outcome.error });
  return respond(200, { ok: true, inviterId: outcome.inviterId });
}

export async function createCommunity(respond, account, body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : '';
  const visibility = ['public', 'private', 'hidden'].includes(body.visibility) ? body.visibility : 'public';

  if (!name) return respond(400, { ok: false, error: 'Community name required' });
  if (!validSlug(slug)) {
    return respond(400, { ok: false, error: 'Community slug must be lowercase letters, numbers and hyphens' });
  }

  try {
    const community = await transaction(async (client) => {
      const result = await client.query(
        `insert into communities(owner_id,slug,name,description,visibility)
         values($1,$2,$3,$4,$5)
         returning id,slug,name,description,visibility,created_at`,
        [account.id, slug, name, description, visibility],
      );
      const item = result.rows[0];
      await client.query(
        `insert into community_members(community_id,account_id,role,status)
         values($1,$2,'owner','active')`,
        [item.id, account.id],
      );
      return item;
    });
    await markMilestone(account.id, 'first_community_at');
    return respond(201, { ok: true, community });
  } catch (error) {
    if (String(error?.code) === '23505') {
      return respond(409, { ok: false, error: 'That community slug is already in use' });
    }
    throw error;
  }
}

export async function discoverCommunities(respond, account, limit = 30) {
  const safeLimit = Math.min(Math.max(Number(limit || 30), 1), 100);
  const result = await query(
    `select c.id,c.slug,c.name,c.description,c.created_at,
            count(cm.account_id)::int as member_count,
            coalesce(bool_or(cm.account_id=$1 and cm.status='active'),false) as joined
       from communities c
       left join community_members cm on cm.community_id=c.id
      where c.status='active' and c.visibility='public'
      group by c.id
      order by member_count desc,c.created_at desc
      limit $2`,
    [account.id, safeLimit],
  );
  return respond(200, {
    ok: true,
    ranking: 'Public communities ordered by member count and recency; no behavioural profile used.',
    communities: result.rows,
  });
}

export async function joinCommunity(respond, account, communityId) {
  const exists = await query(
    `select id,visibility,status from communities where id=$1 limit 1`,
    [communityId],
  );
  const community = exists.rows[0];
  if (!community || community.status !== 'active') {
    return respond(404, { ok: false, error: 'Community not found' });
  }
  if (community.visibility !== 'public') {
    return respond(403, { ok: false, error: 'This community requires an invite' });
  }

  await query(
    `insert into community_members(community_id,account_id,role,status)
     values($1,$2,'member','active')
     on conflict(community_id,account_id) do update
       set status='active'`,
    [communityId, account.id],
  );
  await markMilestone(account.id, 'first_community_at');
  return respond(200, { ok: true, status: 'active' });
}

export async function createCommunityInvite(respond, account, communityId, body = {}) {
  const membership = await query(
    `select role from community_members
      where community_id=$1 and account_id=$2 and status='active'
      limit 1`,
    [communityId, account.id],
  );
  const role = membership.rows[0]?.role;
  if (!['owner', 'admin', 'moderator'].includes(role)) {
    return respond(403, { ok: false, error: 'Community moderator access required' });
  }

  const maxUses = Number.isInteger(body.maxUses)
    ? Math.min(Math.max(body.maxUses, 1), 10000)
    : null;
  const days = Number.isInteger(body.expiresInDays)
    ? Math.min(Math.max(body.expiresInDays, 1), 365)
    : 30;

  let created;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const inviteCode = code('G');
    try {
      const result = await query(
        `insert into community_invites(community_id,inviter_id,code,max_uses,expires_at)
         values($1,$2,$3,$4,now()+($5 || ' days')::interval)
         returning id,code,max_uses,use_count,expires_at,created_at`,
        [communityId, account.id, inviteCode, maxUses, String(days)],
      );
      created = result.rows[0];
      break;
    } catch (error) {
      if (String(error?.code) !== '23505' || attempt === 3) throw error;
    }
  }

  return respond(201, { ok: true, invite: created });
}

export async function redeemCommunityInvite(respond, account, inviteCode) {
  const normalized = String(inviteCode || '').trim().toUpperCase();
  const outcome = await transaction(async (client) => {
    const result = await client.query(
      `select ci.*,c.status
         from community_invites ci
         join communities c on c.id=ci.community_id
        where ci.code=$1 and ci.active=true and c.status='active'
          and (ci.expires_at is null or ci.expires_at > now())
          and (ci.max_uses is null or ci.use_count < ci.max_uses)
        for update of ci`,
      [normalized],
    );
    if (!result.rowCount) return { error: 'Community invite is invalid or expired' };
    const invite = result.rows[0];

    const redemption = await client.query(
      `insert into community_invite_redemptions(invite_id,account_id)
       values($1,$2)
       on conflict do nothing
       returning invite_id`,
      [invite.id, account.id],
    );
    await client.query(
      `insert into community_members(community_id,account_id,role,status)
       values($1,$2,'member','active')
       on conflict(community_id,account_id) do update set status='active'`,
      [invite.community_id, account.id],
    );
    if (redemption.rowCount) {
      await client.query(
        'update community_invites set use_count=use_count+1 where id=$1',
        [invite.id],
      );
    }
    return { communityId: invite.community_id, newlyRedeemed: Boolean(redemption.rowCount) };
  });

  if (outcome.error) return respond(409, { ok: false, error: outcome.error });
  await markMilestone(account.id, 'first_community_at');
  return respond(200, { ok: true, communityId: outcome.communityId, newlyRedeemed: outcome.newlyRedeemed });
}

export async function growthSummary(respond) {
  const summary = await query('select * from connecta_growth_summary');
  const recent = await query(
    `select
      (select count(*) from accounts where created_at >= now()-interval '7 days') as new_accounts_7d,
      (select count(*) from onboarding_state where activated_at >= now()-interval '7 days') as activations_7d,
      (select count(*) from communities where created_at >= now()-interval '7 days') as new_communities_7d,
      (select count(*) from posts where created_at >= now()-interval '7 days' and moderation_state='allowed') as posts_7d`,
  );
  return respond(200, {
    ok: true,
    privacy: 'Aggregate operational metrics only; no behavioural profiling.',
    totals: summary.rows[0] || {},
    last7Days: recent.rows[0] || {},
  });
}
