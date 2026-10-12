import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';

export const ROLES = ['PLATFORM_ADMIN','ORG_OWNER','ORG_ADMIN','COACH','ATHLETE','OFFICIAL','SPONSOR','SCOUT','FAN'] as const;
export type Role = typeof ROLES[number];

type AuthContext = {
  authenticated: boolean;
  userId?: string;
  organisationId?: string;
  role?: Role;
  scopes: string[];
  authType?: 'session' | 'api_key';
};

declare module 'fastify' { interface FastifyRequest { auth: AuthContext; } }

const publicRoutes = new Set(['/health', '/api/v1/sports', '/api/v1/sponsor/match-preview']);
const publicRoutePrefixes = ['/api/v1/athletes/'];
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function authenticate(req: FastifyRequest, pool: Pool): Promise<AuthContext> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return { authenticated: false, scopes: [] };
  const token = header.slice(7).trim();
  if (!token) return { authenticated: false, scopes: [] };
  const tokenHash = hashToken(token);

  const session = await pool.query(`select s.user_id from sessions s where s.token_hash=$1 and s.revoked_at is null and s.expires_at > now() limit 1`, [tokenHash]);
  if (session.rows[0]) {
    const userId = session.rows[0].user_id as string;
    const membership = await pool.query(`select organisation_id, role from organisation_members where user_id=$1 and status='active' order by created_at asc limit 1`, [userId]);
    const m = membership.rows[0];
    return { authenticated: true, userId, organisationId: m?.organisation_id, role: m?.role as Role | undefined, scopes: [], authType: 'session' };
  }

  const key = await pool.query(`select id, organisation_id, scopes from api_keys where key_hash=$1 and revoked_at is null and (expires_at is null or expires_at > now()) limit 1`, [tokenHash]);
  if (key.rows[0]) {
    await pool.query(`update api_keys set last_used_at=now() where id=$1`, [key.rows[0].id]);
    const scopes = (key.rows[0].scopes ?? []) as string[];
    const role: Role | undefined = scopes.includes('*') || scopes.includes('org:admin') ? 'ORG_ADMIN' : undefined;
    return { authenticated: true, organisationId: key.rows[0].organisation_id ?? undefined, role, scopes, authType: 'api_key' };
  }
  return { authenticated: false, scopes: [] };
}

export function installSecurity(app: FastifyInstance, pool: Pool) {
  app.decorateRequest('auth', null);
  app.addHook('preHandler', async (req, reply) => {
    const path = req.url.split('?')[0];
    if (publicRoutes.has(path) || publicRoutePrefixes.some(prefix => path.startsWith(prefix)) || path.startsWith('/api/v1/billing/webhooks/')) {
      req.auth = { authenticated: false, scopes: [] };
      const bearer = req.headers.authorization;
      if (bearer?.startsWith('Bearer ')) req.auth = await authenticate(req, pool);
      return;
    }
    req.auth = await authenticate(req, pool);
    if (!req.auth.authenticated) return reply.code(401).send({ error: 'authentication_required' });
  });
}

export function requireRoles(req: FastifyRequest, reply: FastifyReply, roles: Role[]) {
  if (!req.auth.authenticated) return reply.code(401).send({ error: 'authentication_required' });
  if (req.auth.role === 'PLATFORM_ADMIN' || (req.auth.role && roles.includes(req.auth.role))) return;
  return reply.code(403).send({ error: 'forbidden', requiredRoles: roles });
}

export function requireOrganisation(req: FastifyRequest, reply: FastifyReply, organisationId: string) {
  if (!req.auth.authenticated) return reply.code(401).send({ error: 'authentication_required' });
  if (req.auth.role === 'PLATFORM_ADMIN' || req.auth.organisationId === organisationId) return;
  return reply.code(403).send({ error: 'organisation_scope_violation' });
}

export async function audit(pool: Pool, req: FastifyRequest, action: string, resourceType: string, resourceId?: string, organisationId?: string) {
  await pool.query(`insert into audit_logs(actor_user_id,organisation_id,action,resource_type,resource_id,request_id,ip_address,user_agent,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [req.auth.userId ?? null, organisationId ?? req.auth.organisationId ?? null, action, resourceType, resourceId ?? null, req.id, req.ip ?? null, req.headers['user-agent'] ?? null, { authType: req.auth.authType ?? null }]);
}
