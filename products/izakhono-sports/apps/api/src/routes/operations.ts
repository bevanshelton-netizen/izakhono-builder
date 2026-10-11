import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { audit, requireOrganisation, requireRoles } from '../security/auth.js';

const uuid = z.string().uuid();
const member = z.object({ athleteId: uuid, role: z.string().default('athlete'), validFrom: z.string().optional(), validTo: z.string().optional() });
const participant = z.object({ teamId: uuid, seed: z.number().int().optional() });

export async function registerOperationsRoutes(app: FastifyInstance, pool: Pool) {
  app.post('/api/v1/teams/:teamId/members', async (req, reply) => {
    try {
      const teamId = uuid.parse(String((req.params as any).teamId));
      const team = (await pool.query('select organisation_id from teams where id=$1',[teamId])).rows[0];
      if (!team) return reply.code(404).send({ error: 'team_not_found' });
      if (requireOrganisation(req,reply,team.organisation_id) || requireRoles(req,reply,['ORG_OWNER','ORG_ADMIN','COACH'])) return;
      const x = member.parse(req.body);
      const result = await pool.query(`insert into team_members(team_id,athlete_id,role,valid_from,valid_to) values($1,$2,$3,$4,$5) returning *`,[teamId,x.athleteId,x.role,x.validFrom??null,x.validTo??null]);
      await audit(pool,req,'team.member.add','team_member',`${teamId}:${x.athleteId}`,team.organisation_id);
      return reply.code(201).send({ data: result.rows[0] });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.post('/api/v1/competitions/:competitionId/participants', async (req, reply) => {
    try {
      const competitionId = uuid.parse(String((req.params as any).competitionId));
      const competition = (await pool.query('select organisation_id from competitions where id=$1',[competitionId])).rows[0];
      if (!competition) return reply.code(404).send({ error: 'competition_not_found' });
      if (requireOrganisation(req,reply,competition.organisation_id) || requireRoles(req,reply,['ORG_OWNER','ORG_ADMIN','OFFICIAL'])) return;
      const x = participant.parse(req.body);
      const result = await pool.query(`insert into competition_participants(competition_id,team_id,seed) values($1,$2,$3) returning *`,[competitionId,x.teamId,x.seed??null]);
      await audit(pool,req,'competition.participant.add','competition_participant',`${competitionId}:${x.teamId}`,competition.organisation_id);
      return reply.code(201).send({ data: result.rows[0] });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.get('/api/v1/competitions/:competitionId/schedule', async (req, reply) => {
    try {
      const competitionId = uuid.parse(String((req.params as any).competitionId));
      const competition = (await pool.query('select organisation_id from competitions where id=$1',[competitionId])).rows[0];
      if (!competition) return reply.code(404).send({ error: 'competition_not_found' });
      if (requireOrganisation(req,reply,competition.organisation_id) || requireRoles(req,reply,['ORG_OWNER','ORG_ADMIN','COACH','OFFICIAL','ATHLETE','FAN'])) return;
      const { rows } = await pool.query(`select e.*,v.name as venue_name,v.city as venue_city from events e left join venues v on v.id=e.venue_id where e.competition_id=$1 order by e.starts_at`,[competitionId]);
      return { data: rows };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });
}
