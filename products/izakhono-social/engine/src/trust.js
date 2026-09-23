import { query, transaction } from './db.js';

async function notify(client, { accountId, kind, actorId = null, targetType = null, targetId = null, title, body }) {
  await client.query(
    `insert into notifications(account_id,kind,actor_id,target_type,target_id,title,body)
     values($1,$2,$3,$4,$5,$6,$7)`,
    [accountId, kind, actorId, targetType, targetId, title, body],
  );
}

async function blockedBetween(client, first, second) {
  const result = await client.query(
    `select 1 from safety_blocks
      where (blocker_id=$1 and blocked_id=$2) or (blocker_id=$2 and blocked_id=$1)
      limit 1`,
    [first, second],
  );
  return Boolean(result.rowCount);
}

export async function shareContent({ sharerId, sourceType, sourceId, commentary = '' }) {
  if (!['post', 'media'].includes(sourceType)) return { error: 'Unsupported share type' };

  return transaction(async (client) => {
    let source;
    if (sourceType === 'post') {
      const result = await client.query(
        `select p.id,p.author_id as owner_id,p.visibility,p.moderation_state,p.deleted_at,
                pr.handle,pr.display_name
           from posts p join profiles pr on pr.account_id=p.author_id
          where p.id=$1 limit 1`,
        [sourceId],
      );
      source = result.rows[0];
      if (!source || source.deleted_at || source.visibility !== 'public' || source.moderation_state !== 'allowed') {
        return { error: 'Only allowed public posts can be shared' };
      }
    } else {
      const result = await client.query(
        `select m.id,m.owner_id,m.moderation_state,pr.handle,pr.display_name
           from media_assets m
           join profiles pr on pr.account_id=m.owner_id
          where m.id=$1
            and m.moderation_state='allowed'
            and exists(
              select 1 from post_media pm
              join posts p on p.id=pm.post_id
              where pm.media_id=m.id
                and p.visibility='public'
                and p.moderation_state='allowed'
                and p.deleted_at is null
            )
          limit 1`,
        [sourceId],
      );
      source = result.rows[0];
      if (!source) return { error: 'Only media attached to an allowed public post can be shared' };
    }

    if (source.owner_id === sharerId) return { error: 'Use the original content instead of sharing it to yourself' };
    if (await blockedBetween(client, sharerId, source.owner_id)) {
      return { error: 'Safety block prevents this share' };
    }

    const share = await client.query(
      `insert into content_shares(sharer_id,owner_id,source_type,source_id,commentary)
       values($1,$2,$3,$4,$5)
       returning id,source_type,source_id,commentary,status,created_at`,
      [sharerId, source.owner_id, sourceType, sourceId, String(commentary || '').trim().slice(0, 1000)],
    );

    const sharer = await client.query(
      'select display_name,handle from profiles where account_id=$1 limit 1',
      [sharerId],
    );
    const who = sharer.rows[0]?.display_name || sharer.rows[0]?.handle || 'Someone';
    await notify(client, {
      accountId: source.owner_id,
      kind: 'content_shared',
      actorId: sharerId,
      targetType: sourceType,
      targetId: sourceId,
      title: `Your ${sourceType === 'post' ? 'post' : 'picture/media'} was shared`,
      body: `${who} shared your ${sourceType === 'post' ? 'post' : 'picture/media'} on CONNECTA. The share keeps your original ownership and attribution.`,
    });

    return { share: share.rows[0], originalOwnerId: source.owner_id };
  });
}

export async function duplicateMediaCheck({ suspectedMediaId, suspectedOwnerId, sha256 }) {
  if (!sha256) return null;

  return transaction(async (client) => {
    const original = await client.query(
      `select id,owner_id from media_assets
        where sha256=$1 and owner_id<>$2 and id<>$3
        order by created_at asc
        limit 1`,
      [sha256, suspectedOwnerId, suspectedMediaId],
    );
    if (!original.rowCount) return null;

    const first = original.rows[0];
    await client.query(
      `insert into content_duplicate_alerts(
         original_media_id,original_owner_id,suspected_media_id,suspected_owner_id,match_type
       ) values($1,$2,$3,$4,'sha256')
       on conflict(original_media_id,suspected_media_id) do nothing`,
      [first.id, first.owner_id, suspectedMediaId, suspectedOwnerId],
    );
    await client.query(
      "update media_assets set moderation_state='review' where id=$1",
      [suspectedMediaId],
    );
    await notify(client, {
      accountId: first.owner_id,
      kind: 'content_duplicate_detected',
      actorId: suspectedOwnerId,
      targetType: 'media',
      targetId: suspectedMediaId,
      title: 'Possible copy of your picture/media detected',
      body: 'CONNECTA detected an exact-file match to media you previously uploaded. The new upload has been held for review and your ownership record has been preserved.',
    });
    return { originalMediaId: first.id, originalOwnerId: first.owner_id };
  });
}

export async function listNotifications(accountId) {
  const result = await query(
    `select n.id,n.kind,n.actor_id,n.target_type,n.target_id,n.title,n.body,n.read_at,n.created_at,
            p.handle as actor_handle,p.display_name as actor_name
       from notifications n
       left join profiles p on p.account_id=n.actor_id
      where n.account_id=$1
      order by n.created_at desc
      limit 100`,
    [accountId],
  );
  return result.rows;
}

export async function markNotificationRead(accountId, notificationId) {
  const result = await query(
    `update notifications set read_at=coalesce(read_at,now())
      where id=$1 and account_id=$2
      returning id,read_at`,
    [notificationId, accountId],
  );
  return result.rows[0] || null;
}

export async function submitBusinessVerification(accountId, body = {}) {
  const legalName = String(body.legalName || '').trim().slice(0, 160);
  const tradingName = String(body.tradingName || legalName).trim().slice(0, 160);
  const registrationNumber = String(body.registrationNumber || '').trim().slice(0, 100) || null;
  const countryCode = String(body.countryCode || '').trim().toUpperCase().slice(0, 2);
  const website = String(body.website || '').trim().slice(0, 500) || null;
  const businessEmail = String(body.businessEmail || '').trim().toLowerCase().slice(0, 320) || null;

  if (!legalName || !tradingName || !/^[A-Z]{2}$/.test(countryCode)) {
    return { error: 'legalName, tradingName and a two-letter countryCode are required' };
  }

  try {
    const result = await transaction(async (client) => {
      const business = await client.query(
        `insert into businesses(
          owner_id,legal_name,trading_name,registration_number,country_code,website,business_email
        ) values($1,$2,$3,$4,$5,$6,$7)
        returning id,legal_name,trading_name,registration_number,country_code,website,business_email,
                  verification_state,verification_level,created_at`,
        [accountId, legalName, tradingName, registrationNumber, countryCode, website, businessEmail],
      );
      await client.query(
        `insert into business_verification_events(business_id,actor_subject,action,note)
         values($1,$2,'submitted','Business verification submitted for owner review')`,
        [business.rows[0].id, accountId],
      );
      return business.rows[0];
    });
    return { business: result };
  } catch (error) {
    if (String(error?.code) === '23505') {
      return { error: 'A business with that registration number is already under verification or verified' };
    }
    throw error;
  }
}

export async function listBusinessVerifications() {
  const result = await query(
    `select b.*,p.handle as owner_handle,p.display_name as owner_name
       from businesses b
       join profiles p on p.account_id=b.owner_id
      where b.verification_state in ('pending','reviewing')
      order by b.created_at asc
      limit 200`,
  );
  return result.rows;
}

export async function decideBusinessVerification({ businessId, action, reviewer = 'owner', note = '' }) {
  const allowed = new Set(['reviewing','verified','rejected','suspended']);
  if (!allowed.has(action)) return { error: 'Unsupported verification action' };

  return transaction(async (client) => {
    const locked = await client.query('select * from businesses where id=$1 for update', [businessId]);
    if (!locked.rowCount) return { error: 'Business not found' };
    const business = locked.rows[0];

    const updated = await client.query(
      `update businesses set
          verification_state=$1,
          verification_level=case when $1='verified' then 'registered_business' else verification_level end,
          verified_at=case when $1='verified' then now() else verified_at end,
          verified_by=case when $1='verified' then $2 else verified_by end,
          rejection_reason=case when $1='rejected' then $3 else rejection_reason end,
          updated_at=now()
        where id=$4
        returning id,owner_id,legal_name,trading_name,country_code,verification_state,verification_level,verified_at`,
      [action, reviewer, String(note || '').slice(0, 1000), businessId],
    );

    await client.query(
      `insert into business_verification_events(business_id,actor_subject,action,note)
       values($1,$2,$3,$4)`,
      [businessId, reviewer, action === 'reviewing' ? 'review_started' : action, String(note || '').slice(0, 1000)],
    );

    await notify(client, {
      accountId: business.owner_id,
      kind: 'business_verification',
      targetType: 'account',
      targetId: business.owner_id,
      title: action === 'verified' ? 'Business verified on CONNECTA' : `Business verification: ${action}`,
      body: action === 'verified'
        ? `${business.trading_name} has passed CONNECTA business verification. The verified-business badge may now be displayed.`
        : `Your CONNECTA business verification status is now ${action}.${note ? ' ' + String(note).slice(0, 500) : ''}`,
    });

    return { business: updated.rows[0] };
  });
}

export async function publicBusiness(businessId) {
  const result = await query(
    `select id,trading_name,country_code,website,verification_state,verification_level,verified_at
       from businesses
      where id=$1 and verification_state='verified'
      limit 1`,
    [businessId],
  );
  return result.rows[0] || null;
}
