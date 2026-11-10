import { authorize, type FortressPrincipal, type FortressRole } from '../../fortress-security/src/access-control';
import { getProject, type CreatorStorageEnv } from './project-store';
import { handleCinematicApi } from './cinematic-api';

export type FortressCreatorEnv = CreatorStorageEnv & {
  CREATOR_GENERATION_SECRET?: string;
  FORTRESS_SESSION_HMAC_SECRET?: string;
  FORTRESS_SESSION_ISSUER?: string;
  FORTRESS_SESSION_AUDIENCE?: string;
};
type SessionClaims = { iss?: string; aud?: string | string[]; sub?: string; tenant_id?: string; role?: FortressRole; active?: boolean; iat?: number; exp?: number; jti?: string };
const encoder = new TextEncoder();
const SESSION_COOKIE = '__Host-izakhono_session';
const CSRF_COOKIE = '__Host-izakhono_csrf';
const roles = new Set<FortressRole>(['OWNER', 'SECURITY_ADMIN', 'ANALYST', 'VIEWER']);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'vary': 'Cookie, Authorization' } });
function cookieValue(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const index = part.indexOf('=');
    if (index >= 0 && part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}
function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const raw = atob(base64);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}
function decodeJson<T>(value: string): T { return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T; }
async function verifyFortressSession(request: Request, env: FortressCreatorEnv): Promise<{ principal: FortressPrincipal; expiresAt: number } | null> {
  const secret = env.FORTRESS_SESSION_HMAC_SECRET;
  if (!secret || secret.length < 32) throw new Error('FORTRESS session verification is not configured.');
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearer || cookieValue(request, SESSION_COOKIE);
  if (!token || token.length > 8192) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header: { alg?: string; typ?: string }; let claims: SessionClaims;
  try { header = decodeJson(parts[0]); claims = decodeJson(parts[1]); } catch { return null; }
  if (header.alg !== 'HS256' || (header.typ && header.typ !== 'JWT')) return null;
  const issuer = env.FORTRESS_SESSION_ISSUER || 'https://fortress.izakhono.internal';
  const audience = env.FORTRESS_SESSION_AUDIENCE || 'izakhono-creator';
  if (claims.iss !== issuer) return null;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) return null;
  if (!claims.sub || claims.sub.length > 200 || !claims.tenant_id || claims.tenant_id.length > 200) return null;
  if (!claims.jti || claims.jti.length > 200 || !claims.active || !claims.role || !roles.has(claims.role)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.exp! <= now || claims.iat! > now + 60 || claims.exp! - claims.iat! > 900) return null;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signatureBytes = decodeBase64Url(parts[2]);
  const signature = new Uint8Array(signatureBytes.length);
  signature.set(signatureBytes);
  const signedContent = encoder.encode(parts.slice(0, 2).join('.'));
  const valid = await crypto.subtle.verify('HMAC', key, signature.buffer, signedContent.buffer);
  if (!valid) return null;
  return { principal: { id: claims.sub, tenantId: claims.tenant_id, role: claims.role, active: claims.active }, expiresAt: claims.exp! };
}
function requireCsrf(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  const cookie = cookieValue(request, CSRF_COOKIE);
  const header = request.headers.get('x-csrf-token');
  return Boolean(cookie && header && cookie.length >= 32 && cookie === header);
}
function permissionFor(method: string, path: string): string {
  if (path === '/api/cinematic/projects') return method === 'GET' ? 'creator:read' : 'creator:write';
  if (/\/approvals\//.test(path)) return 'creator:approve';
  if (/\/tasks\/[^/]+\/submit$/.test(path)) return 'creator:generate';
  if (/\/tasks\/[^/]+\/status$/.test(path)) return 'creator:read';
  if (/\/tasks\//.test(path)) return 'creator:write';
  return method === 'GET' ? 'creator:read' : 'creator:write';
}
function internalRequest(request: Request, secret: string, body?: unknown): Request {
  const headers = new Headers(request.headers);
  headers.set('x-creator-generation-secret', secret);
  headers.delete('cookie'); headers.delete('authorization'); headers.delete('x-csrf-token');
  return new Request(request.url, { method: request.method, headers,
    ...(body === undefined ? { body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body } : { body: JSON.stringify(body) }) });
}
export async function handleFortressCinematicGateway(request: Request, env: FortressCreatorEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === '/api/cinematic/session' && request.method === 'GET') {
    try {
      const session = await verifyFortressSession(request, env);
      if (!session) return json({ authenticated: false, error: 'A valid FORTRESS session is required.' }, 401);
      authorize(session.principal, session.principal.tenantId, 'creator:read');
      return json({ authenticated: true, userId: session.principal.id, tenantId: session.principal.tenantId, role: session.principal.role, expiresAt: session.expiresAt, csrfRequired: !request.headers.has('authorization') });
    } catch (error) { return json({ authenticated: false, error: error instanceof Error ? error.message : 'FORTRESS verification unavailable.' }, 503); }
  }
  if (!url.pathname.startsWith('/api/cinematic/')) return null;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, PATCH, OPTIONS' } });
  let session: { principal: FortressPrincipal; expiresAt: number } | null;
  try { session = await verifyFortressSession(request, env); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'FORTRESS verification unavailable.' }, 503); }
  if (!session) return json({ error: 'A valid FORTRESS session is required.' }, 401);
  if (!env.CREATOR_GENERATION_SECRET) return json({ error: 'Creator service credential is not configured.' }, 503);
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
  if (request.method !== 'GET' && !request.headers.has('authorization') && !requireCsrf(request)) return json({ error: 'CSRF validation failed.' }, 403);
  const path = url.pathname;
  try { authorize(session.principal, session.principal.tenantId, permissionFor(request.method, path)); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'FORTRESS permission denied.' }, 403); }
  const projectMatch = path.match(/^\/api\/cinematic\/projects\/([^/]+)/);
  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);
    const project = await getProject(env, projectId);
    if (!project) return json({ error: 'project not found.' }, 404);
    const graph = (project.packageData as Record<string, unknown> | null)?.cinematicProduction as { metadata?: { tenantId?: string } } | undefined;
    if (!graph?.metadata?.tenantId || graph.metadata.tenantId !== session.principal.tenantId) return json({ error: 'FORTRESS tenant isolation denied access to this production.' }, 404);
  }
  let forwardedBody: unknown;
  if (request.method !== 'GET') {
    forwardedBody = await request.json().catch(() => null);
    if (!forwardedBody || typeof forwardedBody !== 'object' || Array.isArray(forwardedBody)) return json({ error: 'A valid JSON object is required.' }, 400);
    const body = forwardedBody as Record<string, unknown>;
    if (path === '/api/cinematic/projects' && request.method === 'POST') {
      if (typeof body.brief !== 'string' || !body.brief.trim()) return json({ error: 'brief is required.' }, 400);
      forwardedBody = { ...body, ownerId: session.principal.id, tenantId: session.principal.tenantId };
    } else if (/\/approvals\//.test(path) && request.method === 'POST') forwardedBody = { ...body, approverId: session.principal.id };
  }
  const serviceRequest = internalRequest(request, env.CREATOR_GENERATION_SECRET, forwardedBody);
  const result = await handleCinematicApi(serviceRequest, env);
  if (!result) return json({ error: 'Unknown cinematic API route.' }, 404);
  if (path === '/api/cinematic/projects' && request.method === 'GET') {
    const data = await result.json() as { projects?: Array<Record<string, unknown>> };
    const projects = (data.projects || []).filter(project => {
      const production = project.production as { metadata?: { tenantId?: string } } | undefined;
      return production?.metadata?.tenantId === session!.principal.tenantId;
    });
    return json({ projects });
  }
  return result;
}
