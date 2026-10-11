import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { z } from 'zod';
import { paymentAdapter } from '../domain/payments.js';
import { audit, requireOrganisation, requireRoles } from '../security/auth.js';

const uuid = z.string().uuid();
const checkout = z.object({ organisationId: uuid, campaignId: uuid.optional(), reference: z.string().min(3).max(120), purpose: z.string().min(2).max(80), amount: z.number().nonnegative(), currency: z.string().length(3).default('ZAR'), provider: z.string().default(process.env.PAYMENT_PROVIDER || 'mock'), metadata: z.record(z.unknown()).optional() });

export async function registerBillingRoutes(app: FastifyInstance, pool: Pool) {
  app.post('/api/v1/billing/checkout', async (req, reply) => {
    try {
      const b = checkout.parse(req.body);
      if (requireOrganisation(req, reply, b.organisationId) || requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN'])) return;
      const adapter = paymentAdapter(b.provider);
      const result = await adapter.createCheckout({ reference: b.reference, amount: b.amount, currency: b.currency, purpose: b.purpose, metadata: b.metadata });
      const { rows } = await pool.query(`insert into payment_orders(organisation_id,campaign_id,reference,purpose,amount,currency_code,provider,provider_reference,status,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`, [b.organisationId, b.campaignId ?? null, b.reference, b.purpose, b.amount, b.currency, result.provider, result.providerReference, result.status, b.metadata ?? {}]);
      await audit(pool, req, 'billing.checkout.create', 'payment_order', rows[0].id, b.organisationId);
      return reply.code(201).send({ data: { order: rows[0], checkout: result } });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid request' }); }
  });

  app.get('/api/v1/billing/ledger', async (req, reply) => {
    try {
      const q: any = req.query ?? {};
      const organisationId = uuid.parse(String(q.organisationId || req.auth.organisationId || '00000000-0000-0000-0000-000000000000'));
      if (requireOrganisation(req, reply, organisationId) || requireRoles(req, reply, ['ORG_OWNER','ORG_ADMIN'])) return;
      const limit = Math.min(Math.max(Number(q.limit || 100), 1), 500);
      const { rows } = await pool.query(`select * from financial_ledger where organisation_id=$1 order by created_at desc limit $2`, [organisationId, limit]);
      return { data: rows };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'query failed' }); }
  });

  app.post('/api/v1/billing/webhooks/:provider', async (req, reply) => {
    try {
      const provider = String((req.params as any).provider);
      const adapter = paymentAdapter(provider);
      const normalized = await adapter.receiveWebhook(req.body, Object.fromEntries(Object.entries(req.headers).map(([k,v]) => [k, Array.isArray(v) ? v[0] : v])));
      const inserted = await pool.query(`insert into payment_webhook_events(provider,event_id,event_type,payload,processed,processed_at) values($1,$2,$3,$4,true,now()) on conflict(provider,event_id) do nothing returning id`, [provider, normalized.eventId, normalized.eventType, req.body ?? {}]);
      if (normalized.providerReference) await pool.query(`update payment_orders set status=$1,updated_at=now() where provider=$2 and provider_reference=$3`, [normalized.status, provider, normalized.providerReference]);
      return { received: true, duplicate: inserted.rowCount === 0, event: normalized };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'webhook failed' }); }
  });
}
