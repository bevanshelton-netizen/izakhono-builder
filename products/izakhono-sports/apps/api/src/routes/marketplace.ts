import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { audit, requireOrganisation, requireRoles } from '../security/auth.js';

const uuid = z.string().uuid();
const offer = z.object({ inventoryId: uuid, campaignId: uuid, proposedValue: z.number().nonnegative(), currencyCode: z.string().length(3).default('ZAR'), message: z.string().max(4000).optional() });

export async function registerMarketplaceRoutes(app: FastifyInstance, pool: Pool) {
  app.post('/api/v1/marketplace/offers', async (req, reply) => {
    try {
      const x = offer.parse(req.body);
      const inventory = (await pool.query('select id,owner_organisation_id,status,asking_value,currency_code from sponsorship_inventory where id=$1',[x.inventoryId])).rows[0];
      if (!inventory) return reply.code(404).send({ error: 'inventory_not_found' });
      if (inventory.status !== 'available') return reply.code(409).send({ error: 'inventory_unavailable' });
      const campaign = (await pool.query('select id,sponsor_organisation_id,status from sponsor_campaigns where id=$1',[x.campaignId])).rows[0];
      if (!campaign) return reply.code(404).send({ error: 'campaign_not_found' });
      if (requireOrganisation(req, reply, campaign.sponsor_organisation_id) || requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN','SPONSOR'])) return;
      const result = await pool.query(`insert into marketplace_offers(inventory_id,campaign_id,proposed_value,currency_code,message,status,created_by) values($1,$2,$3,$4,$5,'submitted',$6) returning *`, [x.inventoryId,x.campaignId,x.proposedValue,x.currencyCode.toUpperCase(),x.message ?? null,req.auth.userId ?? null]);
      await audit(pool, req, 'marketplace.offer.created', 'marketplace_offer', result.rows[0].id, campaign.sponsor_organisation_id);
      return reply.code(201).send({ data: result.rows[0] });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.get('/api/v1/marketplace/offers/:id', async (req, reply) => {
    try {
      const id = uuid.parse(String((req.params as any).id));
      const row = (await pool.query(`select o.*,i.owner_organisation_id,c.sponsor_organisation_id from marketplace_offers o join sponsorship_inventory i on i.id=o.inventory_id join sponsor_campaigns c on c.id=o.campaign_id where o.id=$1`,[id])).rows[0];
      if (!row) return reply.code(404).send({ error: 'offer_not_found' });
      if (row.owner_organisation_id && requireOrganisation(req, reply, row.owner_organisation_id)) return;
      if (row.sponsor_organisation_id && requireOrganisation(req, reply, row.sponsor_organisation_id)) return;
      if (requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN','SPONSOR','OFFICIAL'])) return;
      return { data: row };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'query failed' }); }
  });

  app.post('/api/v1/marketplace/offers/:id/decision', async (req, reply) => {
    try {
      const id = uuid.parse(String((req.params as any).id));
      const decision = z.object({ status: z.enum(['accepted','rejected','countered']), message: z.string().max(4000).optional() }).parse(req.body);
      const row = (await pool.query(`select o.*,i.owner_organisation_id,c.sponsor_organisation_id from marketplace_offers o join sponsorship_inventory i on i.id=o.inventory_id join sponsor_campaigns c on c.id=o.campaign_id where o.id=$1`,[id])).rows[0];
      if (!row) return reply.code(404).send({ error: 'offer_not_found' });
      if (row.owner_organisation_id && requireOrganisation(req, reply, row.owner_organisation_id)) return;
      if (requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN','OFFICIAL'])) return;
      const updated = await pool.query(`update marketplace_offers set status=$1,decision_message=$2,decided_at=now(),decided_by=$3 where id=$4 returning *`,[decision.status,decision.message ?? null,req.auth.userId ?? null,id]);
      await audit(pool, req, 'marketplace.offer.decision', 'marketplace_offer', id, row.owner_organisation_id);
      return { data: updated.rows[0] };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });
}
