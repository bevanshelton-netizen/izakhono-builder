import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { z } from 'zod';
import { scoreSponsorMatch } from '../domain/sponsor-match.js';
import { audit, requireOrganisation, requireRoles } from '../security/auth.js';

const uuid = z.string().uuid();
const list = (v: unknown) => Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? v.split(',').map(x => x.trim()).filter(Boolean) : [];

export async function registerSponsorRoutes(app: FastifyInstance, pool: Pool) {
  app.post('/api/v1/sponsors', async (req, reply) => {
    try {
      const b: any = req.body;
      const organisationId = uuid.parse(b.organisationId);
      if (requireOrganisation(req, reply, organisationId) || requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN','SPONSOR'])) return;
      const { rows } = await pool.query(`insert into sponsor_profiles(organisation_id,objectives,sectors,target_markets) values($1,$2,$3,$4) returning *`, [organisationId, b.objectives ?? {}, b.sectors ?? [], b.targetMarkets ?? []]);
      await audit(pool, req, 'sponsor_profile.create', 'sponsor_profile', rows[0].id, organisationId);
      return reply.code(201).send({ data: rows[0] });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.get('/api/v1/sponsor-matches', async (req, reply) => {
    try {
      const q: any = req.query ?? {};
      const b = { sports: list(q.sports), geographies: list(q.geographies), objectives: list(q.objectives), audience: list(q.audience), budget: q.budget === undefined ? undefined : Number(q.budget) };
      const { rows } = await pool.query(`select i.*, s.code as sport_code, s.name as sport_name from sponsorship_inventory i left join sports s on s.id=i.sport_id where i.status='available' order by i.id desc limit 250`);
      const matches = rows.map((i: any) => ({ ...i, matchScore: scoreSponsorMatch(b, { sport: i.sport_code, geography: i.audience_definition?.geography, audience: i.audience_definition?.segments ?? [], objectives: i.audience_definition?.objectives ?? [], askingValue: Number(i.asking_value) }) })).sort((a: any,b: any) => b.matchScore-a.matchScore);
      return { data: matches };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.post('/api/v1/sponsorships/activations', async (req, reply) => {
    try {
      const b: any = req.body;
      const campaignId = uuid.parse(b.campaignId);
      const inventoryId = uuid.parse(b.inventoryId);
      const inventory = (await pool.query(`select owner_organisation_id from sponsorship_inventory where id=$1`, [inventoryId])).rows[0];
      if (!inventory) return reply.code(404).send({ error: 'inventory_not_found' });
      if (requireOrganisation(req, reply, inventory.owner_organisation_id) || requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN','SPONSOR'])) return;
      const { rows } = await pool.query(`insert into campaign_activations(campaign_id,inventory_id,contracted_value,status,deliverables) values($1,$2,$3,$4,$5) returning *`, [campaignId, inventoryId, b.contractedValue ?? null, b.status ?? 'planned', b.deliverables ?? {}]);
      await audit(pool, req, 'sponsorship_activation.create', 'campaign_activation', rows[0].id, inventory.owner_organisation_id);
      return reply.code(201).send({ data: rows[0] });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });
}
