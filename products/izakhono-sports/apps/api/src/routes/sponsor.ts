import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { z } from 'zod';
import { scoreSponsorMatch } from '../domain/sponsor-match.js';

const uuid = z.string().uuid();
const brief = z.object({ sports: z.array(z.string()).default([]), geographies: z.array(z.string()).default([]), objectives: z.array(z.string()).default([]), audience: z.array(z.string()).default([]), budget: z.number().nonnegative().optional() });

export async function registerSponsorRoutes(app: FastifyInstance, pool: Pool) {
  app.post('/api/v1/sponsors', async (req, reply) => {
    try {
      const b: any = req.body;
      const organisationId = uuid.parse(b.organisationId);
      const { rows } = await pool.query(`insert into sponsor_profiles(organisation_id,objectives,sectors,target_markets) values($1,$2,$3,$4) returning *`, [organisationId, b.objectives ?? {}, b.sectors ?? [], b.targetMarkets ?? []]);
      return reply.code(201).send({ data: rows[0] });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.get('/api/v1/sponsor-matches', async (req, reply) => {
    try {
      const b = brief.parse(req.query ?? {});
      const { rows } = await pool.query(`select i.*, s.code as sport_code, s.name as sport_name from sponsorship_inventory i left join sports s on s.id=i.sport_id where i.status='available' order by i.created_at desc limit 250`);
      const matches = rows.map((i: any) => ({ ...i, matchScore: scoreSponsorMatch(b, { sport: i.sport_code, geography: i.audience_definition?.geography, audience: i.audience_definition?.segments ?? [], objectives: i.audience_definition?.objectives ?? [], askingValue: Number(i.asking_value) }) })).sort((a: any,b: any) => b.matchScore-a.matchScore);
      return { data: matches };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.post('/api/v1/sponsorships/activations', async (req, reply) => {
    try {
      const b: any = req.body;
      const { rows } = await pool.query(`insert into campaign_activations(campaign_id,inventory_id,contracted_value,status,deliverables) values($1,$2,$3,$4,$5) returning *`, [uuid.parse(b.campaignId), uuid.parse(b.inventoryId), b.contractedValue ?? null, b.status ?? 'planned', b.deliverables ?? {}]);
      return reply.code(201).send({ data: rows[0] });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });
}
