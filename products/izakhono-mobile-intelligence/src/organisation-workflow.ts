import type { CustomerAuthDB, CustomerIdentity } from '../../../src/customer-auth';
import { resolveOrganisationAccess } from './organisation-access';

type WorkflowStatement = {
  bind(...values: unknown[]): WorkflowStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
};
export interface OrganisationWorkflowDB extends CustomerAuthDB {
  prepare(sql: string): WorkflowStatement;
  batch(statements: WorkflowStatement[]): Promise<unknown[]>;
}
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const randomHex = (length = 32) => { const bytes = new Uint8Array(length); crypto.getRandomValues(bytes); return hex(bytes); };
const sha256 = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));

export type InvitationRole = 'admin' | 'member';
export type InvitationResult = { invitationId: string; token: string; expiresAt: string };

/** Invitation creation is restricted to an active owner/admin membership. Owner roles cannot be invited. */
export async function createOrganisationInvitation(
  db: OrganisationWorkflowDB,
  actor: CustomerIdentity,
  organisationId: string,
  email: string,
  role: InvitationRole,
  now = new Date(),
): Promise<InvitationResult> {
  if (actor.status !== 'active' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Invalid invitation request.');
  if (role !== 'admin' && role !== 'member') throw new Error('Only admin or member invitations are permitted.');
  const access = await resolveOrganisationAccess(db, actor, organisationId);
  if (!access || !['owner', 'admin'].includes(access.role)) throw new Error('Organisation administrator access required.');
  const token = randomHex(32), tokenHash = await sha256(token);
  const invitationId = 'boi_' + randomHex(16);
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare(
    `INSERT INTO builder_organisation_invitations
     (id,organisation_id,email,role,token_hash,invited_by_customer_id,expires_at,created_at)
     VALUES(?,?,?,?,?,?,?,?)`,
  ).bind(invitationId, organisationId, email.trim().toLowerCase(), role, tokenHash, actor.id, expiresAt, now.toISOString()).run();
  return { invitationId, token, expiresAt };
}

/** Accepts only a verified, active customer whose email exactly matches the invitation.
 * The invite claim and membership insert are committed as one D1 batch transaction.
 */
export async function acceptOrganisationInvitation(
  db: OrganisationWorkflowDB,
  identity: CustomerIdentity,
  token: string,
  now = new Date(),
): Promise<boolean> {
  if (identity.status !== 'active' || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const tokenHash = await sha256(token);
  const timestamp = now.toISOString();
  const membershipId = 'bom_' + randomHex(16);
  const insert = db.prepare(
    `INSERT INTO builder_organisation_memberships
      (id,organisation_id,customer_id,role,status,invited_by_customer_id,created_at,updated_at)
     SELECT ?,i.organisation_id,c.id,i.role,'active',i.invited_by_customer_id,?,?
     FROM builder_organisation_invitations i
     JOIN builder_customers c ON c.id=?
     JOIN builder_organisations o ON o.id=i.organisation_id
     WHERE i.token_hash=? AND i.email=lower(c.email) COLLATE NOCASE
       AND c.status='active' AND c.email_verified_at IS NOT NULL
       AND o.status='active' AND i.accepted_at IS NULL AND i.revoked_at IS NULL
       AND i.expires_at>?
     ON CONFLICT(organisation_id,customer_id) DO NOTHING`,
  ).bind(membershipId, timestamp, timestamp, identity.id, tokenHash, timestamp);
  const consume = db.prepare(
    `UPDATE builder_organisation_invitations SET accepted_at=?
     WHERE token_hash=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?
       AND EXISTS (SELECT 1 FROM builder_organisation_memberships m
         WHERE m.organisation_id=builder_organisation_invitations.organisation_id
           AND m.customer_id=? AND m.status='active')`,
  ).bind(timestamp, tokenHash, timestamp, identity.id, membershipId);
  const results = await db.batch([insert, consume]);
  const inserted = results[0] as { meta?: { changes?: number } } | undefined;
  const consumed = results[1] as { meta?: { changes?: number } } | undefined;
  return (inserted?.meta?.changes ?? 0) === 1 && (consumed?.meta?.changes ?? 0) === 1;
}
