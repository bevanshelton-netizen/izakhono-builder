import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';

const querySchema = z.object({
  sport: z.string().max(80).optional(),
  country: z.string().length(2).optional(),
  position: z.string().max(80).optional(),
  sponsorshipReady: z.coerce.boolean().optional(),
  scoutingReady: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(10000).default(0)
});

export async function registerDiscoveryRoutes(app: FastifyInstance, pool: Pool) {
  app.get('/api/v1/discovery/athletes', async (req, reply) => {
    try {
      const q = querySchema.parse(req.query);
      const values: unknown[] = [];
      const where: string[] = ["coalesce(p.visibility,'public') <> 'private'"];
      if (q.sport) { values.push(q.sport); where.push(`lower($${values.length}) = any(select lower(x) from unnest(coalesce(p.sports,'{}')) x)`); }
      if (q.country) { values.push(q.country.toUpperCase()); where.push(`upper(coalesce(p.home_country,a.nationality,''))=$${values.length}`); }
      if (q.position) { values.push(q.position); where.push(`lower($${values.length}) = any(select lower(x) from unnest(coalesce(p.positions,'{}')) x)`); }
      if (q.sponsorshipReady !== undefined) { values.push(q.sponsorshipReady); where.push(`coalesce(p.sponsorship_ready,false)=$${values.length}`); }
      if (q.scoutingReady !== undefined) { values.push(q.scoutingReady); where.push(`coalesce(p.scouting_ready,true)=$${values.length}`); }
      const limitIndex = values.push(q.limit);
      const offsetIndex = values.push(q.offset);
      const result = await pool.query(`select a.id,a.sports_uid,a.public_name,a.nationality,p.headline,p.sports,p.positions,p.home_country,p.sponsorship_ready,p.scouting_ready,c.categories,c.markets,c.audience from athletes a left join athlete_profiles p on p.athlete_id=a.id left join athlete_commercial_profiles c on c.athlete_id=a.id and c.active=true where ${where.join(' and ')} order by a.public_name nulls last,a.created_at desc limit $${limitIndex} offset $${offsetIndex}` , values);
      return { data: result.rows.map(r => ({ athleteId: r.id, sportsId: r.sports_uid, publicName: r.public_name, nationality: r.nationality, headline: r.headline, sports: r.sports ?? [], positions: r.positions ?? [], homeCountry: r.home_country, sponsorshipReady: r.sponsorship_ready ?? false, scoutingReady: r.scouting_ready ?? true, commercial: r.sponsorship_ready ? { categories: r.categories ?? [], markets: r.markets ?? [], audience: r.audience ?? [] } : null })) };
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'invalid query' }); }
  });
}
