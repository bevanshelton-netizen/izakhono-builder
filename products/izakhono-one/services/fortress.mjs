import { createAuditEvent } from './audit.mjs';

const roles = Object.freeze(['owner','admin','operator','member','guest']);
const decisions = new Set(['allow','deny','review']);
const permissions = Object.freeze({
  owner: Object.freeze(['*']),
  admin: Object.freeze(['read','manage','configure','execute']),
  operator: Object.freeze(['read','execute']),
  member: Object.freeze(['read']),
  guest: Object.freeze([])
});
const resourceScopes = Object.freeze({
  platform: Object.freeze(['owner','admin']),
  service: Object.freeze(['owner','admin','operator','member']),
  security: Object.freeze(['owner','admin','operator']),
  unknown: Object.freeze([])
});

export function normalizePrincipal(input = {}) {
  const id = String(input.id || '').trim();
  const role = roles.includes(input.role) ? input.role : 'guest';
  return { id, role, authenticated: Boolean(input.authenticated), verified: Boolean(input.verified) };
}

function resourceClass(resource) {
  const target = String(resource || '').trim();
  if (target === 'platform') return 'platform';
  if (target === 'security' || target.startsWith('security:')) return 'security';
  if (target.startsWith('service:')) return 'service';
  return 'unknown';
}

export function evaluateAuthorization({ principal = {}, action = 'read', resource = 'platform', sensitive = false } = {}) {
  const subject = normalizePrincipal(principal);
  const capability = String(action || '').trim();
  const target = String(resource || '').trim();
  const scope = resourceClass(target);
  if (!subject.id) return { decision:'deny', reason:'principal_required', resource:target, action:capability };
  if (!subject.authenticated) return { decision:'deny', reason:'authentication_required', resource:target, action:capability };
  if (!capability) return { decision:'deny', reason:'action_required', resource:target, action:capability };
  if (!target || scope === 'unknown') return { decision:'deny', reason:'resource_not_authorized', resource:target, action:capability };
  if (!resourceScopes[scope].includes(subject.role) && subject.role !== 'owner') return { decision:'deny', reason:'resource_scope_denied', resource:target, action:capability, role:subject.role, scope };
  if (sensitive && !subject.verified) return { decision:'review', reason:'verification_required', resource:target, action:capability, role:subject.role, scope };
  const allowed = permissions[subject.role]?.includes('*') || permissions[subject.role]?.includes(capability);
  return { decision:allowed?'allow':'deny', reason:allowed?'authorization_granted':'permission_denied', resource:target, action:capability, role:subject.role, scope };
}

export function authorizeRequest({ principal = {}, service = '', action = '', resource, sensitive = false, destructive = false, payment = false, correlationId = null } = {}) {
  const subject = normalizePrincipal(principal);
  const slug = String(service || '').trim();
  const capability = String(action || '').trim();
  const target = String(resource || (slug ? `service:${slug}` : 'platform')).trim();
  const elevated = Boolean(sensitive || destructive || payment);
  const authorization = evaluateAuthorization({ principal:subject, action:capability, resource:target, sensitive:elevated });
  return {
    ...authorization,
    service: slug || null,
    resource: target,
    correlationId: correlationId || null,
    gate: 'FORTRESS',
    audit: createAuditEvent({ principal:subject, service:slug, resource:target, action:capability, decision:authorization.decision, reason:authorization.reason, sensitive, destructive, payment, correlationId }),
    sideEffects: false,
    decisionValid: isFortressDecision(authorization.decision)
  };
}

export function isFortressDecision(value) { return decisions.has(value); }
export function fortressRoles() { return [...roles]; }
export function fortressPermissions() { return Object.fromEntries(Object.entries(permissions).map(([role, values]) => [role, [...values]])); }
export function fortressResourceScopes() { return Object.fromEntries(Object.entries(resourceScopes).map(([scope, values]) => [scope, [...values]])); }
