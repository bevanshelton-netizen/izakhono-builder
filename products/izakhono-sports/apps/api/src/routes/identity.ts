import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { audit, requireOrganisation, requireRoles } from '../security/auth.js';

const uuid = z.string().uuid();
const role = z.enum(['ORG_OWNER','ORG_ADMIN','COACH','ATHLETE','OFFICIAL','SPONSOR','SCOUT','FAN']);
const provision = z.object({ email: z.string().email(), displayName: z.string().min(2), organisationName: z.string().min(2), organisationType: z.enum(['club','academy','school','league','federation','venue','agency','sponsor','media','other']).default('club'), countryCode: z.string().length(2).optional(), currencyCode: z.string().length(3).default('ZAR') });
const invite = z.object({ email: z.string().email(), role });
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const provisionAttempts = new Map<string, { count: number; resetAt: number }>();

function allowProvision(ip: string) {
  const now = Date.now();
  const current = provisionAttempts.get(ip);
  if (!current || current.resetAt <= now) { provisionAttempts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 }); return true; }
  if (current.count >= 5) return false;
  current.count += 1;
  return true;
}

export async function registerIdentityRoutes(app: FastifyInstance, pool: Pool) {
  app.post('/api/v1/identity/provision', async (req, reply) => {
    if (!allowProvision(req.ip)) return reply.code(429).send({ error: 'too_many_requests', retryAfterSeconds: 3600 });
    try {
      const x = provision.parse(req.body);
      const existing = await pool.query('select id from users where lower(email)=lower($1) limit 1', [x.email]);
      if (existing.rows[0]) return reply.code(409).send({ error: 'user_already_exists' });
      const result = await pool.query('insert into provisioning_requests(email,display_name,organisation_name,organisation_type,country_code,currency_code) values($1,$2,$3,$4,$5,$6) returning id,status,created_at', [x.email,x.displayName,x.organisationName,x.organisationType,x.countryCode?.toUpperCase() ?? null,x.currencyCode.toUpperCase()]);
      return reply.code(202).send({ data: { requestId: result.rows[0].id, status: result.rows[0].status } });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.post('/api/v1/organizations/:id/invitations', async (req, reply) => {
    try {
      const organisationId = uuid.parse(String((req.params as any).id));
      if (requireOrganisation(req, reply, organisationId)) return;
      if (requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN'])) return;
      const x = invite.parse(req.body);
      const token = randomBytes(32).toString('hex');
      const result = await pool.query('insert into organisation_invitations(organisation_id,email,role,token_hash,expires_at,created_by) values($1,$2,$3,$4,now()+interval \'7 days\',$5) returning id,email,role,expires_at', [organisationId,x.email,x.role,hashToken(token),req.auth.userId ?? null]);
      await audit(pool, req, 'organization.invitation.created', 'organisation_invitation', result.rows[0].id, organisationId);
      return reply.code(201).send({ data: { ...result.rows[0], token, deliveryStatus: 'pending' } });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.get('/api/v1/organizations/:id/invitations', async (req, reply) => {
    try {
      const organisationId = uuid.parse(String((req.params as any).id));
      if (requireOrganisation(req, reply, organisationId)) return;
      if (requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN'])) return;
      const { rows } = await pool.query('select id,email,role,expires_at,accepted_at,created_at from organisation_invitations where organisation_id=$1 order by created_at desc limit 100', [organisationId]);
      return { data: rows };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'query failed' }); }
  });

  app.post('/api/v1/identity/invitations/accept', async (req, reply) => {
    try {
      const x = z.object({ token: z.string().min(32) }).parse(req.body);
      if (!req.auth.authenticated || !req.auth.userId) return reply.code(401).send({ error: 'authentication_required' });
      const client = await pool.connect();
      try {
        await client.query('begin');
        const invitation = (await client.query(`select id,organisation_id,email,role from organisation_invitations where token_hash=$1 and accepted_at is null and expires_at > now() for update`, [hashToken(x.token)])).rows[0];
        if (!invitation) { await client.query('rollback'); return reply.code(404).send({ error: 'invitation_invalid_or_expired' }); }
        const user = (await client.query('select email from users where id=$1',[req.auth.userId])).rows[0];
        if (!user || String(user.email).toLowerCase() !== String(invitation.email).toLowerCase()) { await client.query('rollback'); return reply.code(403).send({ error: 'invitation_email_mismatch' }); }
        await client.query(`insert into organisation_members(organisation_id,user_id,role,status) values($1,$2,$3,'active') on conflict (organisation_id,user_id) do update set role=excluded.role,status='active'`,[invitation.organisation_id,req.auth.userId,invitation.role]);
        await client.query('update organisation_invitations set accepted_at=now() where id=$1',[invitation.id]);
        await client.query('commit');
        await audit(pool, req, 'organization.invitation.accepted', 'organisation_invitation', invitation.id, invitation.organisation_id);
        return { data: { accepted: true, organisationId: invitation.organisation_id, role: invitation.role } };
      } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });
}
