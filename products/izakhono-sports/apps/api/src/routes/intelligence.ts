import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { requireOrganisation, requireRoles } from '../security/auth.js';
import { genericPoints, summariseResults } from '../domain/sports-intelligence.js';

const uuid = z.string().uuid();
const viewerRoles = ['ORG_OWNER','ORG_ADMIN','COACH','OFFICIAL','ATHLETE','SPONSOR','SCOUT','FAN'] as const;

async function competitionScope(pool: Pool, req: any, reply: any, competitionId: string) {
  const row = (await pool.query('select id, organisation_id, sport_id, name from competitions where id=$1', [competitionId])).rows[0];
  if (!row) { reply.code(404).send({ error: 'competition_not_found' }); return null; }
  if (row.organisation_id && requireOrganisation(req, reply, row.organisation_id)) return null;
  if (requireRoles(req, reply, [...viewerRoles])) return null;
  return row;
}

export async function registerIntelligenceRoutes(app: FastifyInstance, pool: Pool) {
  app.get('/api/v1/competitions/:competitionId/standings', async (req, reply) => {
    try {
      const competitionId = uuid.parse(String((req.params as any).competitionId));
      const competition = await competitionScope(pool, req, reply, competitionId);
      if (!competition) return;
      const { rows } = await pool.query(`
        with participant_results as (
          select cp.team_id::text as participant_key, r.id, r.score, r.placing,
                 coalesce(nullif(r.result_payload->>'points','')::numeric, null) as explicit_points
          from competition_participants cp
          left join results r on r.event_id in (select id from events where competition_id=$1)
             and r.participant_key = cp.team_id::text
          where cp.competition_id=$1
        )
        select participant_key, count(id)::int as events,
               coalesce(sum(coalesce(explicit_points, case when placing=1 then 3 when placing=2 then 2 when placing=3 then 1 else 0 end)),0)::numeric as points,
               count(*) filter (where placing=1)::int as wins,
               count(*) filter (where placing between 1 and 3)::int as podiums,
               min(placing) as best_placing
        from participant_results
        group by participant_key
        order by points desc, wins desc, best_placing asc nulls last, participant_key`, [competitionId]);
      return { data: rows.map((r, i) => ({ rank: i + 1, ...r, scoringMode: 'generic_placing' })) };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'query failed' }); }
  });

  app.get('/api/v1/competitions/:competitionId/statistics', async (req, reply) => {
    try {
      const competitionId = uuid.parse(String((req.params as any).competitionId));
      const competition = await competitionScope(pool, req, reply, competitionId);
      if (!competition) return;
      const { rows } = await pool.query(`
        select
          count(distinct e.id)::int as events,
          count(distinct e.id) filter (where e.status='completed')::int as completed_events,
          count(distinct e.id) filter (where e.starts_at > now() and e.status='scheduled')::int as upcoming_events,
          count(distinct cp.team_id)::int as teams,
          count(distinct r.id)::int as results
        from competitions c
        left join events e on e.competition_id=c.id
        left join competition_participants cp on cp.competition_id=c.id
        left join results r on r.event_id=e.id
        where c.id=$1`, [competitionId]);
      return { data: { competition, ...rows[0] } };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'query failed' }); }
  });

  app.get('/api/v1/teams/:teamId/performance', async (req, reply) => {
    try {
      const teamId = uuid.parse(String((req.params as any).teamId));
      const team = (await pool.query('select id,name,organisation_id,sport_id from teams where id=$1', [teamId])).rows[0];
      if (!team) return reply.code(404).send({ error: 'team_not_found' });
      if (requireOrganisation(req, reply, team.organisation_id) || requireRoles(req, reply, [...viewerRoles])) return;
      const { rows } = await pool.query(`
        select r.id as result_id, r.participant_key, r.score, r.placing, r.result_payload,
               e.id as event_id, e.starts_at, e.status, c.id as competition_id, c.name as competition_name
        from results r
        join events e on e.id=r.event_id
        left join competitions c on c.id=e.competition_id
        where r.participant_key=$1 order by e.starts_at desc`, [teamId]);
      const results = rows.map(r => ({ resultId: r.result_id, participantKey: r.participant_key, score: r.score, placing: r.placing, points: genericPoints(r.placing, Number(r.result_payload?.points)) }));
      return { data: { team, summary: summariseResults(results), results: rows } };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'query failed' }); }
  });

  app.get('/api/v1/athletes/:athleteId/performance', async (req, reply) => {
    try {
      const athleteId = uuid.parse(String((req.params as any).athleteId));
      const athlete = (await pool.query('select id,sports_uid,public_name,nationality,sports_id from athletes where id=$1', [athleteId])).rows[0];
      if (!athlete) return reply.code(404).send({ error: 'athlete_not_found' });
      if (requireRoles(req, reply, [...viewerRoles])) return;
      const { rows } = await pool.query(`
        select distinct r.id as result_id, r.participant_key, r.score, r.placing, r.result_payload,
               e.id as event_id, e.starts_at, e.status, c.id as competition_id, c.name as competition_name
        from event_participants ep
        join events e on e.id=ep.event_id
        left join competitions c on c.id=e.competition_id
        join results r on r.event_id=e.id
        where ep.athlete_id=$1 or r.participant_key=$2
        order by e.starts_at desc`, [athleteId, athleteId.toString()]);
      const results = rows.map(r => ({ resultId: r.result_id, participantKey: r.participant_key, score: r.score, placing: r.placing, points: genericPoints(r.placing, Number(r.result_payload?.points)) }));
      return { data: { athlete, summary: summariseResults(results), results: rows } };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'query failed' }); }
  });
}
