import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { requireOrganisation, requireRoles } from '../security/auth.js';
import { normaliseMediaItem, sortMediaFeed } from '../domain/media-feed.js';

const uuid = z.string().uuid();
const roles = ['ORG_OWNER','ORG_ADMIN','COACH','OFFICIAL','ATHLETE','SPONSOR','SCOUT','FAN'] as const;
const headline = z.object({ title: z.string().min(1).max(180), body: z.string().min(1).max(2000), competitionId: uuid.optional(), eventId: uuid.optional() });

export async function registerMediaRoutes(app: FastifyInstance, pool: Pool) {
  app.get('/api/v1/media/feed', async (req, reply) => {
    try {
      if (requireRoles(req, reply, [...roles])) return;
      const query = z.object({ sportId: uuid.optional(), competitionId: uuid.optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(req.query);
      const rows = await pool.query(`
        select e.id as event_id, e.starts_at, e.status, e.competition_id, c.name as competition_name,
               c.sport_id,
               coalesce(json_agg(json_build_object('id',r.id,'participantKey',r.participant_key,'score',r.score,'placing',r.placing,'createdAt',r.created_at) order by r.placing nulls last) filter (where r.id is not null), '[]') as results
        from events e
        left join competitions c on c.id=e.competition_id
        left join results r on r.event_id=e.id
        where ($1::uuid is null or c.sport_id=$1)
          and ($2::uuid is null or e.competition_id=$2)
          and (c.organisation_id is null or exists (select 1 from organisation_members om where om.organisation_id=c.organisation_id and om.user_id=$3 and om.status='active'))
        group by e.id,c.name,c.sport_id
        order by e.starts_at desc limit $4`, [query.sportId ?? null, query.competitionId ?? null, req.auth.userId ?? null, query.limit]);
      const items = rows.rows.flatMap(r => [normaliseMediaItem({ id: `event:${r.event_id}`, type: 'event', title: `${r.competition_name ?? 'Sports event'}`, body: `Event status: ${r.status}. Results: ${r.results.length}.`, publishedAt: new Date(r.starts_at).toISOString(), sportId: r.sport_id, competitionId: r.competition_id, eventId: r.event_id })]);
      return { data: sortMediaFeed(items) };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'query failed' }); }
  });

  app.post('/api/v1/media/headlines', async (req, reply) => {
    try {
      if (requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN','OFFICIAL'])) return;
      const x = headline.parse(req.body);
      let organisationId: string | null = null;
      if (x.competitionId) {
        const row = (await pool.query('select organisation_id from competitions where id=$1',[x.competitionId])).rows[0];
        if (!row) return reply.code(404).send({ error: 'competition_not_found' });
        organisationId = row.organisation_id;
        if (organisationId && requireOrganisation(req, reply, organisationId)) return;
      }
      return reply.code(201).send({ data: normaliseMediaItem({ id: `headline:${Date.now()}`, type: 'headline', title: x.title, body: x.body, publishedAt: new Date().toISOString(), competitionId: x.competitionId, eventId: x.eventId }) });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });
}
