import { randomUUID } from 'node:crypto';
import { query, transaction } from './db.js';

const PUBLIC_STATES = new Set(['ACTIVE']);

function text(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function discoveryFilters(params = {}) {
  const values = [];
  const where = ["trust_status = 'ACTIVE'"];

  if (params.kind) {
    values.push(params.kind);
    where.push(`kind=$${values.length}`);
  }
  if (params.category) {
    values.push(params.category);
    where.push(`category=$${values.length}`);
  }
  if (params.q) {
    values.push(`%${params.q}%`);
    where.push(`(title ilike $${values.length} or description ilike $${values.length} or provider_name ilike $${values.length})`);
  }

  return { where: where.join(' and '), values };
}

export async function discover(params = {}) {
  const { where, values } = discoveryFilters(params);
  const limit = Math.min(Math.max(Number(params.limit || 30), 1), 100);
  values.push(limit);
  const result = await query(
    `select id,kind,title,category,description,provider_name,terms_url,
            starts_at,ends_at,price_display,currency,location_text,metadata,
            verified_at,updated_at
       from connecta_public_discovery
      where ${where}
      order by updated_at desc
      limit $${values.length}`,
    values,
  );
  return result.rows;
}

export async function createDiscoveryRecord(input, actorId = null) {
  const kind = text(input.kind, 30);
  if (!['benefit', 'commerce', 'vehicle'].includes(kind)) throw new Error('Unsupported discovery kind');
  const title = text(input.title, 180);
  const category = text(input.category, 100);
  if (!title || !category) throw new Error('Discovery title and category are required');

  const result = await query(
    `insert into connecta_discovery_records
      (kind,title,category,description,provider_name,provider_id,trust_status,source_reference,agreement_reference,terms_url,starts_at,ends_at,price_display,currency,location_text,metadata,created_by)
     values($1,$2,$3,$4,$5,$6,'SUBMITTED',$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)
     returning *`,
    [
      kind,
      title,
      category,
      text(input.description, 4000),
      text(input.providerName, 180) || null,
      input.providerId || null,
      text(input.sourceReference, 500) || null,
      text(input.agreementReference, 500) || null,
      text(input.termsUrl, 1000) || null,
      input.startsAt || null,
      input.endsAt || null,
      text(input.priceDisplay, 120) || null,
      text(input.currency, 12) || null,
      text(input.locationText, 240) || null,
      JSON.stringify(input.metadata || {}),
      actorId,
    ],
  );
  return result.rows[0];
}

export async function submitVerification(recordId, evidenceType, evidenceReference) {
  if (!recordId || !evidenceType || !evidenceReference) throw new Error('Verification evidence is required');
  return transaction(async (client) => {
    const record = await client.query(
      `update connecta_discovery_records
          set trust_status='VERIFICATION_PENDING',updated_at=now()
        where id=$1 and trust_status in ('SUBMITTED','VERIFICATION_PENDING')
        returning id,trust_status`,
      [recordId],
    );
    if (!record.rowCount) return null;
    const evidence = await client.query(
      `insert into connecta_discovery_verifications(record_id,evidence_type,evidence_reference,decision)
       values($1,$2,$3,'PENDING') returning *`,
      [recordId, text(evidenceType, 100), text(evidenceReference, 1000)],
    );
    return { record: record.rows[0], evidence: evidence.rows[0] };
  });
}

export async function decideVerification(recordId, decision, reviewerSubject, notes = '') {
  if (!['VERIFIED', 'REJECTED', 'REVOKED'].includes(decision)) throw new Error('Invalid verification decision');
  return transaction(async (client) => {
    const evidence = await client.query(
      `update connecta_discovery_verifications
          set decision=$2,reviewer_subject=$3,notes=$4,decided_at=now()
        where record_id=$1 and decision='PENDING'
        returning id`,
      [recordId, decision, text(reviewerSubject, 180) || null, text(notes, 2000)],
    );
    if (!evidence.rowCount) return null;
    const state = decision === 'VERIFIED' ? 'ACTIVE' : decision === 'REVOKED' ? 'SUSPENDED' : 'REJECTED';
    const record = await client.query(
      `update connecta_discovery_records
          set trust_status=$2,verified_at=case when $2='ACTIVE' then now() else verified_at end,updated_at=now()
        where id=$1 returning *`,
      [recordId, state],
    );
    return record.rows[0] || null;
  });
}

export async function createEnquiry(recordId, requesterId, message = '', consentToContact = false, campaignId = null) {
  return transaction(async (client) => {
    const record = await client.query(
      `select id,provider_id from connecta_discovery_records where id=$1 and trust_status='ACTIVE' limit 1`,
      [recordId],
    );
    if (!record.rowCount) return null;
    const attributionId = `cx-${randomUUID()}`;
    const enquiry = await client.query(
      `insert into connecta_discovery_enquiries(record_id,requester_id,consent_to_contact,message,attribution_id)
       values($1,$2,$3,$4,$5) returning *`,
      [recordId, requesterId, Boolean(consentToContact), text(message, 4000), attributionId],
    );
    await client.query(
      `insert into connecta_discovery_attribution(enquiry_id,campaign_id,partner_id)
       values($1,$2,$3)`,
      [enquiry.rows[0].id, text(campaignId, 180) || null, record.rows[0].provider_id || null],
    );
    return enquiry.rows[0];
  });
}

export const discoveryTrust = Object.freeze({
  publicStates: [...PUBLIC_STATES],
  rule: 'Only ACTIVE records are publicly discoverable; enquiries never imply sales or conversion.',
});
