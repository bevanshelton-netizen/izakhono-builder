import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { audit, requireOrganisation, requireRoles } from '../security/auth.js';

const uuid = z.string().uuid();
const eventUpdate = z.object({ status: z.enum(['scheduled','live','completed','cancelled','postponed']).optional(), metadata: z.record(z.any()).optional() });
const result = z.object({ participantKey: z.string().min(1), score: z.number().nullable().optional(), placing: z.number().int().positive().nullable().optional(), resultPayload: z.record(z.any()).optional() });
const approve = z.object({ approved: z.boolean() });

async function eventScope(pool: Pool, req: any, reply: any, eventId: string) {
  const row = (await pool.query(`select e.id,e.competition_id,e.status,e.metadata,c.organisation_id,c.rules_profile_id from events e left join competitions c on c.id=e.competition_id where e.id=$1`, [eventId])).rows[0];
  if (!row) { reply.code(404).send({ error: 'event_not_found' }); return null; }
  if (row.organisation_id && requireOrganisation(req, reply, row.organisation_id)) return null;
  if (requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN','OFFICIAL','COACH'])) return null;
  return row;
}

export async function registerLiveRoutes(app: FastifyInstance, pool: Pool) {
  app.patch('/api/v1/events/:eventId/live', async (req, reply) => {
    try {
      const eventId = uuid.parse(String((req.params as any).eventId));
      const event = await eventScope(pool, req, reply, eventId); if (!event) return;
      const x = eventUpdate.parse(req.body);
      const mergedMetadata = x.metadata ? { ...(event.metadata ?? {}), ...x.metadata } : event.metadata;
      const result = await pool.query('update events set status=coalesce($1,status), metadata=$2 where id=$3 returning *', [x.status ?? null, mergedMetadata, eventId]);
      await audit(pool, req, 'event.live.update', 'event', eventId, event.organisation_id ?? null);
      return { data: result.rows[0] };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.post('/api/v1/events/:eventId/results', async (req, reply) => {
    try {
      const eventId = uuid.parse(String((req.params as any).eventId));
      const event = await eventScope(pool, req, reply, eventId); if (!event) return;
      const x = result.parse(req.body);
      const inserted = await pool.query(`insert into results(event_id,participant_key,score,placing,result_payload) values($1,$2,$3,$4,$5) returning *`, [eventId,x.participantKey,x.score ?? null,x.placing ?? null,x.resultPayload ?? {}]);
      await audit(pool, req, 'event.result.recorded', 'result', inserted.rows[0].id, event.organisation_id ?? null);
      return reply.code(201).send({ data: inserted.rows[0] });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.post('/api/v1/events/:eventId/results/:resultId/approval', async (req, reply) => {
    try {
      const eventId = uuid.parse(String((req.params as any).eventId));
      const resultId = uuid.parse(String((req.params as any).resultId));
      const event = await eventScope(pool, req, reply, eventId); if (!event) return;
      const x = approve.parse(req.body);
      const result = await pool.query(`update results set result_payload = result_payload || jsonb_build_object('officialApproval', $1::boolean, 'approvedAt', now()) where id=$2 and event_id=$3 returning *`, [x.approved, resultId, eventId]);
      if (!result.rows[0]) return reply.code(404).send({ error: 'result_not_found' });
      await audit(pool, req, 'event.result.approval', 'result', resultId, event.organisation_id ?? null);
      return { data: result.rows[0] };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.get('/api/v1/events/:eventId/live', async (req, reply) => {
    try {
      const eventId = uuid.parse(String((req.params as any).eventId));
      const event = (await pool.query(`select e.*,c.name as competition_name,c.organisation_id from events e left join competitions c on c.id=e.competition_id where e.id=$1`, [eventId])).rows[0];
      if (!event) return reply.code(404).send({ error: 'event_not_found' });
      if (event.organisation_id && requireOrganisation(req, reply, event.organisation_id)) return;
      if (requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN','COACH','OFFICIAL','ATHLETE','SPONSOR','SCOUT','FAN'])) return;
      const { rows } = await pool.query('select * from results where event_id=$1 order by placing nulls last, created_at', [eventId]);
      return { data: { event, results: rows } };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'query failed' }); }
  });
}
