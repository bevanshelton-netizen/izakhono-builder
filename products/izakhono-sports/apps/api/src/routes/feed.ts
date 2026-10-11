import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { requireOrganisation, requireRoles } from '../security/auth.js';

const uuid = z.string().uuid();
const publicRoles = ['ORG_OWNER','ORG_ADMIN','COACH','OFFICIAL','ATHLETE','SPONSOR','SCOUT','FAN'] as const;

export async function registerFeedRoutes(app: FastifyInstance, pool: Pool) {
  app.get('/api/v1/events/:eventId/feed', async (req, reply) => {
    const eventId = uuid.parse(String((req.params as any).eventId));
    const event = (await pool.query(`select e.*,c.name as competition_name,c.organisation_id from events e left join competitions c on c.id=e.competition_id where e.id=$1`, [eventId])).rows[0];
    if (!event) return reply.code(404).send({ error: 'event_not_found' });
    if (event.organisation_id && requireOrganisation(req, reply, event.organisation_id)) return;
    if (requireRoles(req, reply, [...publicRoles])) return;
    const { rows } = await pool.query(`select id,participant_key,score,placing,result_payload,created_at from results where event_id=$1 order by created_at desc limit 100`, [eventId]);
    return { data: { event, results: rows, generatedAt: new Date().toISOString() } };
  });

  app.get('/api/v1/competitions/:competitionId/feed', async (req, reply) => {
    const competitionId = uuid.parse(String((req.params as any).competitionId));
    const competition = (await pool.query('select id,name,organisation_id,status,rules_profile_id from competitions where id=$1', [competitionId])).rows[0];
    if (!competition) return reply.code(404).send({ error: 'competition_not_found' });
    if (competition.organisation_id && requireOrganisation(req, reply, competition.organisation_id)) return;
    if (requireRoles(req, reply, [...publicRoles])) return;
    const { rows } = await pool.query(`
      select e.id as event_id,e.starts_at,e.status,e.metadata,
             r.id as result_id,r.participant_key,r.score,r.placing,r.result_payload,r.created_at
      from events e left join results r on r.event_id=e.id
      where e.competition_id=$1 order by coalesce(r.created_at,e.starts_at) desc limit 250`, [competitionId]);
    return { data: { competition, items: rows, generatedAt: new Date().toISOString() } };
  });
}
