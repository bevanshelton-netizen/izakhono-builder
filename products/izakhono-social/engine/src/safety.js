import { query, transaction } from './db.js';
import {
  FORMAL_VIOLATION_WARNING,
  PROTECTIVE_LOCK_NOTICE,
  ZERO_TOLERANCE_CATEGORIES,
  identitySkeleton,
  normalizeSafetyCategory,
  similarity,
} from './safety-utils.js';

export {
  FORMAL_VIOLATION_WARNING,
  PROTECTIVE_LOCK_NOTICE,
  ZERO_TOLERANCE_CATEGORIES,
  identitySkeleton,
  normalizeSafetyCategory,
  similarity,
} from './safety-utils.js';

async function targetAccount(client, targetType, targetId) {
  const lookups = {
    account: ['select id from accounts where id=$1', 'id'],
    post: ['select author_id as id from posts where id=$1', 'id'],
    comment: ['select author_id as id from comments where id=$1', 'id'],
    message: ['select sender_id as id from messages where id=$1', 'id'],
    media: ['select owner_id as id from media_assets where id=$1', 'id'],
    community: ['select owner_id as id from communities where id=$1', 'id'],
  };
  const lookup = lookups[targetType];
  if (!lookup) return null;
  const result = await client.query(lookup[0], [targetId]);
  return result.rows[0]?.[lookup[1]] || null;
}

async function insertNotice(client, accountId, caseId, noticeType, notice) {
  await client.query(
    `insert into safety_notices(account_id,moderation_case_id,notice_type,title,body)
     values($1,$2,$3,$4,$5)`,
    [accountId, caseId, noticeType, notice.title, notice.body],
  );
}

async function separateAccounts(client, reporterId, targetAccountId, category) {
  if (!reporterId || !targetAccountId || reporterId === targetAccountId) return;
  await client.query(
    `insert into safety_blocks(blocker_id,blocked_id,source,reason)
     values($1,$2,'report',$3)
     on conflict(blocker_id,blocked_id) do update set reason=excluded.reason`,
    [reporterId, targetAccountId, category],
  );
  await client.query(
    `insert into safety_blocks(blocker_id,blocked_id,source,reason)
     values($1,$2,'system',$3)
     on conflict(blocker_id,blocked_id) do update set reason=excluded.reason`,
    [targetAccountId, reporterId, category],
  );
  await client.query(
    'delete from follows where (follower_id=$1 and followed_id=$2) or (follower_id=$2 and followed_id=$1)',
    [reporterId, targetAccountId],
  );
}

export async function safetyReport({ reporterId, targetType, targetId, reason, detail }) {
  const category = normalizeSafetyCategory(reason);
  return transaction(async (client) => {
    const targetAccountId = await targetAccount(client, targetType, targetId);
    if (!targetAccountId) return { error: 'Reported target was not found' };
    if (targetAccountId === reporterId) return { error: 'You cannot report yourself' };

    const existing = await client.query(
      `select id from reports
        where reporter_id=$1 and target_type=$2 and target_id=$3 and status in ('open','triaged')
        limit 1`,
      [reporterId, targetType, targetId],
    );
    if (existing.rowCount) {
      return { reportId: existing.rows[0].id, targetAccountId, category, duplicate: true };
    }

    const report = await client.query(
      `insert into reports(reporter_id,target_type,target_id,reason,detail,status)
       values($1,$2,$3,$4,$5,'triaged')
       returning id`,
      [reporterId, targetType, targetId, category, String(detail || '').slice(0, 2000)],
    );
    const reportId = report.rows[0].id;

    const moderation = await client.query(
      `insert into moderation_cases(source,target_type,target_id,category,severity,state,rationale)
       values('user_report',$1,$2,$3,5,'reviewing',$4)
       returning id`,
      [targetType, targetId, category, 'Immediate zero-tolerance safety lock pending urgent review.'],
    );
    const caseId = moderation.rows[0].id;

    await separateAccounts(client, reporterId, targetAccountId, category);
    await client.query(
      `update accounts
          set status='restricted',updated_at=now()
        where id=$1 and status='active'`,
      [targetAccountId],
    );
    await client.query(
      'update sessions set revoked_at=now() where account_id=$1 and revoked_at is null',
      [targetAccountId],
    );
    await client.query(
      `insert into account_enforcements(account_id,moderation_case_id,report_id,category,action,rationale)
       values($1,$2,$3,$4,'protective_lock',$5)`,
      [targetAccountId, caseId, reportId, category, 'Immediate temporary safety lock pending review.'],
    );
    await insertNotice(client, targetAccountId, caseId, 'protective_lock', PROTECTIVE_LOCK_NOTICE);

    if (category === 'impersonation' || category === 'account-cloning') {
      await client.query(
        `insert into identity_alerts(suspected_account_id,protected_account_id,signal,score,detail)
         values($1,$2,'user_report',1,$3)`,
        [targetAccountId, reporterId, String(detail || '').slice(0, 1000)],
      );
    }

    return { reportId, caseId, targetAccountId, category, duplicate: false };
  });
}

async function removeTargetContent(client, targetType, targetId) {
  if (targetType === 'post') {
    await client.query("update posts set moderation_state='removed' where id=$1", [targetId]);
  } else if (targetType === 'comment') {
    await client.query("update comments set moderation_state='removed' where id=$1", [targetId]);
  } else if (targetType === 'message') {
    await client.query("update messages set moderation_state='removed' where id=$1", [targetId]);
  } else if (targetType === 'media') {
    await client.query("update media_assets set moderation_state='removed' where id=$1", [targetId]);
  } else if (targetType === 'community') {
    await client.query("update communities set status='suspended' where id=$1", [targetId]);
  }
}

export async function confirmViolation(caseId, reviewer = 'owner', note = '') {
  return transaction(async (client) => {
    const result = await client.query('select * from moderation_cases where id=$1 for update', [caseId]);
    if (!result.rowCount) return null;
    const item = result.rows[0];
    const accountId = await targetAccount(client, item.target_type, item.target_id);
    if (!accountId) return null;

    await removeTargetContent(client, item.target_type, item.target_id);
    await client.query(
      `update moderation_cases
          set state='actioned',action='disable',reviewer_subject=$1,
              rationale=case when $2='' then rationale else $2 end,updated_at=now()
        where id=$3`,
      [reviewer, String(note || '').slice(0, 2000), caseId],
    );
    await client.query(
      "update accounts set status='suspended',updated_at=now() where id=$1",
      [accountId],
    );
    await client.query(
      'update sessions set revoked_at=now() where account_id=$1 and revoked_at is null',
      [accountId],
    );
    await client.query(
      `insert into account_enforcements(account_id,moderation_case_id,category,action,rationale)
       values($1,$2,$3,'disabled',$4)`,
      [accountId, caseId, item.category, String(note || item.rationale || '').slice(0, 2000)],
    );
    await insertNotice(client, accountId, caseId, 'formal_violation_warning', FORMAL_VIOLATION_WARNING);
    await client.query(
      `update reports set status='resolved',resolved_at=now()
        where target_type=$1 and target_id=$2 and status in ('open','triaged')`,
      [item.target_type, item.target_id],
    );
    return { accountId, category: item.category, action: 'disabled' };
  });
}

export async function clearSafetyCase(caseId, reviewer = 'owner', note = '') {
  return transaction(async (client) => {
    const result = await client.query('select * from moderation_cases where id=$1 for update', [caseId]);
    if (!result.rowCount) return null;
    const item = result.rows[0];
    const accountId = await targetAccount(client, item.target_type, item.target_id);
    if (!accountId) return null;

    await client.query(
      `update moderation_cases
          set state='cleared',action='none',reviewer_subject=$1,
              rationale=case when $2='' then rationale else $2 end,updated_at=now()
        where id=$3`,
      [reviewer, String(note || '').slice(0, 2000), caseId],
    );
    await client.query(
      `update account_enforcements
          set state='reversed',ended_at=now()
        where moderation_case_id=$1 and state='active'`,
      [caseId],
    );

    const other = await client.query(
      `select 1 from account_enforcements
        where account_id=$1 and state='active' and action in ('protective_lock','disabled')
        limit 1`,
      [accountId],
    );
    if (!other.rowCount) {
      await client.query("update accounts set status='active',updated_at=now() where id=$1 and status='restricted'", [accountId]);
      await insertNotice(client, accountId, caseId, 'restoration', {
        title: 'CONNECTA SAFETY REVIEW COMPLETED',
        body: 'The safety restriction associated with this case has been cleared. Your account has been restored where no other active enforcement applies.',
      });
    }
    await client.query(
      `update reports set status='dismissed',resolved_at=now()
        where target_type=$1 and target_id=$2 and status in ('open','triaged')`,
      [item.target_type, item.target_id],
    );
    return { accountId, action: 'cleared' };
  });
}

export async function automaticViolation({ accountId, targetType = 'account', targetId, category, rationale }) {
  const safeCategory = ZERO_TOLERANCE_CATEGORIES.has(category) ? category : 'harassment';
  return transaction(async (client) => {
    const caseRow = await client.query(
      `insert into moderation_cases(source,target_type,target_id,category,severity,state,action,rationale,reviewer_subject)
       values('automatic',$1,$2,$3,5,'actioned','disable',$4,'CONNECTA SAFETY ENGINE')
       returning id`,
      [targetType, targetId || accountId, safeCategory, String(rationale || '').slice(0, 2000)],
    );
    const caseId = caseRow.rows[0].id;
    await client.query("update accounts set status='suspended',updated_at=now() where id=$1", [accountId]);
    await client.query('update sessions set revoked_at=now() where account_id=$1 and revoked_at is null', [accountId]);
    await client.query(
      `insert into account_enforcements(account_id,moderation_case_id,category,action,rationale)
       values($1,$2,$3,'disabled',$4)`,
      [accountId, caseId, safeCategory, String(rationale || '').slice(0, 2000)],
    );
    await insertNotice(client, accountId, caseId, 'formal_violation_warning', FORMAL_VIOLATION_WARNING);
    return { caseId, accountId, category: safeCategory, action: 'disabled' };
  });
}

export async function protectIdentity(accountId, verificationState = 'reviewed') {
  const row = await query(
    'select handle,display_name from profiles where account_id=$1 limit 1',
    [accountId],
  );
  if (!row.rowCount) return null;
  const profile = row.rows[0];
  await query(
    `insert into protected_identities(account_id,handle_skeleton,display_name_skeleton,verification_state,protected)
     values($1,$2,$3,$4,true)
     on conflict(account_id) do update set
       handle_skeleton=excluded.handle_skeleton,
       display_name_skeleton=excluded.display_name_skeleton,
       verification_state=excluded.verification_state,
       protected=true,
       updated_at=now()`,
    [accountId, identitySkeleton(profile.handle), identitySkeleton(profile.display_name), verificationState],
  );
  return { accountId, protected: true, verificationState };
}

export async function scanIdentityClone({ handle, displayName }) {
  const h = identitySkeleton(handle);
  const d = identitySkeleton(displayName);
  const rows = await query(
    `select pi.account_id,pi.handle_skeleton,pi.display_name_skeleton,p.handle,p.display_name
       from protected_identities pi
       join profiles p on p.account_id=pi.account_id
      where pi.protected=true`,
  );

  let best = null;
  for (const candidate of rows.rows) {
    const handleScore = similarity(h, candidate.handle_skeleton);
    const displayScore = similarity(d, candidate.display_name_skeleton);
    const strongHandleClone = handleScore >= 0.88;
    const combinedClone = handleScore >= 0.72 && displayScore >= 0.95;
    const score = strongHandleClone
      ? handleScore
      : combinedClone
        ? (handleScore * 0.65 + displayScore * 0.35)
        : 0;
    if (score > 0 && (!best || score > best.score)) {
      best = { ...candidate, score, handleScore, displayScore };
    }
  }
  return best;
}

export async function createIdentityAlert({ suspectedAccountId, protectedAccountId, signal, score, detail }) {
  await query(
    `insert into identity_alerts(suspected_account_id,protected_account_id,signal,score,detail)
     values($1,$2,$3,$4,$5)`,
    [suspectedAccountId, protectedAccountId, signal, score, String(detail || '').slice(0, 1000)],
  );
}

export async function listSafetyNotices(accountId) {
  const result = await query(
    `select id,notice_type,title,body,delivered_at,acknowledged_at
       from safety_notices where account_id=$1
      order by delivered_at desc limit 50`,
    [accountId],
  );
  return result.rows;
}

export async function listIdentityAlerts() {
  const result = await query(
    `select ia.*,sus.handle as suspected_handle,sus.display_name as suspected_name,
            protected.handle as protected_handle,protected.display_name as protected_name
       from identity_alerts ia
       left join profiles sus on sus.account_id=ia.suspected_account_id
       join profiles protected on protected.account_id=ia.protected_account_id
      where ia.state in ('open','reviewing')
      order by ia.score desc,ia.created_at asc
      limit 200`,
  );
  return result.rows;
}
