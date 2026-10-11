import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { audit, requireRoles } from '../security/auth.js';

const id = z.string().uuid();
const profile = z.object({ headline: z.string().max(160).optional(), bio: z.string().max(4000).optional(), sports: z.array(z.string()).max(20).optional(), positions: z.array(z.string()).max(20).optional(), homeCountry: z.string().length(2).optional(), visibility: z.enum(['public','network','private']).optional(), sponsorshipReady: z.boolean().optional(), scoutingReady: z.boolean().optional() });

export async function registerAthleteRoutes(app: FastifyInstance, pool: Pool) {
  app.get('/api/v1/athletes/:athleteId/sports-id', async (req, reply) => {
    const athleteId = id.parse(String((req.params as any).athleteId));
    const athlete = (await pool.query(`select a.id,a.user_id,a.sports_uid,a.public_name,a.nationality,a.safeguarding_status,p.headline,p.bio,p.sports,p.positions,p.home_country,p.visibility,p.sponsorship_ready,p.scouting_ready from athletes a left join athlete_profiles p on p.athlete_id=a.id where a.id=$1`,[athleteId])).rows[0];
    if (!athlete) return reply.code(404).send({ error: 'athlete_not_found' });
    if (athlete.visibility === 'private' && req.auth.userId !== athlete.user_id && req.auth.role !== 'PLATFORM_ADMIN') return reply.code(403).send({ error: 'profile_private' });
    if (athlete.visibility === 'network' && !req.auth.authenticated) return reply.code(403).send({ error: 'network_profile_requires_authentication' });
    return { data: { sportsId: athlete.sports_uid, publicName: athlete.public_name, nationality: athlete.nationality, profile: { headline: athlete.headline, bio: athlete.bio, sports: athlete.sports ?? [], positions: athlete.positions ?? [], homeCountry: athlete.home_country, sponsorshipReady: athlete.sponsorship_ready, scoutingReady: athlete.scouting_ready }, verification: { safeguarding: athlete.safeguarding_status === 'verified' } } };
  });

  app.put('/api/v1/athletes/:athleteId/profile', async (req, reply) => {
    try {
      const athleteId = id.parse(String((req.params as any).athleteId));
      const x = profile.parse(req.body);
      const athlete = (await pool.query('select id,user_id from athletes where id=$1',[athleteId])).rows[0];
      if (!athlete) return reply.code(404).send({ error: 'athlete_not_found' });
      if (athlete.user_id !== req.auth.userId && req.auth.role !== 'PLATFORM_ADMIN') return reply.code(403).send({ error: 'athlete_owner_required' });
      await pool.query(`insert into athlete_profiles(athlete_id,headline,bio,sports,positions,home_country,visibility,sponsorship_ready,scouting_ready) values($1,$2,$3,$4,$5,$6,coalesce($7,'public'),coalesce($8,false),coalesce($9,true)) on conflict (athlete_id) do update set headline=coalesce($2,athlete_profiles.headline),bio=coalesce($3,athlete_profiles.bio),sports=coalesce($4,athlete_profiles.sports),positions=coalesce($5,athlete_profiles.positions),home_country=coalesce($6,athlete_profiles.home_country),visibility=coalesce($7,athlete_profiles.visibility),sponsorship_ready=coalesce($8,athlete_profiles.sponsorship_ready),scouting_ready=coalesce($9,athlete_profiles.scouting_ready),updated_at=now()`,[athleteId,x.headline,x.bio,x.sports ?? null,x.positions ?? null,x.homeCountry ?? null,x.visibility,x.sponsorshipReady,x.scoutingReady]);
      await audit(pool, req, 'athlete.profile.updated', 'athlete', athleteId);
      return { data: { athleteId, updated: true } };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.post('/api/v1/athletes/:athleteId/verifications', async (req, reply) => {
    try {
      const athleteId = id.parse(String((req.params as any).athleteId));
      const x = z.object({ verificationType: z.string().min(2).max(80), evidenceUri: z.string().url().optional() }).parse(req.body);
      if (requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN','OFFICIAL','COACH'])) return;
      const member = (await pool.query(`select 1 from athletes a join team_members tm on tm.athlete_id=a.id join teams t on t.id=tm.team_id join organisation_members om on om.organisation_id=t.organisation_id where a.id=$1 and om.user_id=$2 and om.status='active' limit 1`,[athleteId,req.auth.userId])).rows[0];
      if (!member && req.auth.role !== 'PLATFORM_ADMIN') return reply.code(403).send({ error: 'athlete_scope_violation' });
      const r = await pool.query(`insert into athlete_verifications(athlete_id,verification_type,verified_by,evidence_uri,status,verified_at) values($1,$2,$3,$4,'verified',now()) returning id,verification_type,status,verified_at`,[athleteId,x.verificationType,req.auth.userId,x.evidenceUri ?? null]);
      await audit(pool, req, 'athlete.verification.created', 'athlete_verification', r.rows[0].id);
      return reply.code(201).send({ data: r.rows[0] });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });
}
