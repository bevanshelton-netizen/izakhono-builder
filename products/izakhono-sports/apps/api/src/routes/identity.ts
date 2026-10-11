import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { audit, requireOrganisation, requireRoles } from '../security/auth.js';

const uuid = z.string().uuid();
const role = z.enum(['ORG_OWNER','ORG_ADMIN','COACH','ATHLETE','OFFICIAL','SPONSOR','SCOUT','FAN']);
const provision = z.object({
  email: z.string().email(), displayName: z.string().min(2), organisationName: z.string().min(2),
  organisationType: z.enum(['club','academy','school','league','federation','venue','agency','sponsor','media','other']).default('club'),
  countryCode: z.string().length(2).optional(), currencyCode: z.string().length(3).default('ZAR')
});
const invite = z.object({ email: z.string().email(), role });

export async function registerIdentityRoutes(app: FastifyInstance, pool: Pool) {
  // Public onboarding request. It creates a pending tenant-provisioning job; it does not create an account.
  app.post('/api/v1/identity/provision', async (req, reply) => {
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
      const scope = requireOrganisation(req, reply, organisationId); if (scope) return scope;
      const auth = requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN']); if (auth) return auth;
      const x = invite.parse(req.body);
      const result = await pool.query('insert into organisation_invitations(organisation_id,email,role,token_hash,expires_at,created_by) values($1,$2,$3,encode(gen_random_bytes(32),\'hex\'),now()+interval \'7 days\',$4) returning id,email,role,expires_at', [organisationId,x.email,x.role,req.auth.userId ?? null]);
      await audit(pool, req, 'organization.invitation.created', 'organisation_invitation', result.rows[0].id, organisationId);
      return reply.code(201).send({ data: { ...result.rows[0], deliveryStatus: 'pending' } });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.get('/api/v1/organizations/:id/invitations', async (req, reply) => {
    try {
      const organisationId = uuid.parse(String((req.params as any).id));
      const scope = requireOrganisation(req, reply, organisationId); if (scope) return scope;
      const auth = requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN']); if (auth) return auth;
      const { rows } = await pool.query('select id,email,role,expires_at,accepted_at,created_at from organisation_invitations where organisation_id=$1 order by created_at desc limit 100', [organisationId]);
      return { data: rows };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'query failed' }); }
  });
}
