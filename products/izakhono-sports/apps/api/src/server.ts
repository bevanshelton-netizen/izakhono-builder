import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Pool } from 'pg';
import { registerDomainRoutes } from './routes/domain.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 20 }) : null;

app.get('/health', async () => ({ service: 'izakhono-sports-api', status: 'ok', foundation: 'owned-first', database: pool ? 'configured' : 'not-configured' }));
app.get('/api/v1/sports', async () => {
  if (!pool) return { data: [
    { slug: 'football', name: 'Football' }, { slug: 'rugby', name: 'Rugby' },
    { slug: 'cricket', name: 'Cricket' }, { slug: 'basketball', name: 'Basketball' },
    { slug: 'athletics', name: 'Athletics' }, { slug: 'tennis', name: 'Tennis' },
    { slug: 'swimming', name: 'Swimming' }, { slug: 'boxing', name: 'Boxing' },
    { slug: 'motorsport', name: 'Motorsport' }, { slug: 'esports', name: 'Esports' }
  ] };
  const { rows } = await pool.query('select id, code as slug, name from sports where active = true order by name');
  return { data: rows };
});

app.get('/api/v1/sponsor/match-preview', async () => ({
  data: {
    lifecycle: ['DISCOVER','MATCH','PROPOSE','CONTRACT','ACTIVATE','MEASURE','OPTIMISE','RENEW','EXPAND'],
    scoreFormula: { audienceFit: 0.25, geographyFit: 0.15, sportFit: 0.2, objectiveFit: 0.2, inventoryValue: 0.1, activationFit: 0.1 }
  }
}));

if (pool) await registerDomainRoutes(app, pool);

const port = Number(process.env.PORT || 8080);
await app.listen({ port, host: '0.0.0.0' });
