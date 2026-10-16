const roles = Object.freeze(['owner','admin','operator','member','guest']);
const decisions = new Set(['allow','deny','review']);

const permissions = Object.freeze({
  owner: Object.freeze(['*']),
  admin: Object.freeze(['read','manage','configure','execute']),
  operator: Object.freeze(['read','execute']),
  member: Object.freeze(['read']),
  guest: Object.freeze([])
});

export function normalizePrincipal(input = {}) {
  const id = String(input.id || '').trim();
  const role = roles.includes(input.role) ? input.role : 'guest';
  return { id, role, authenticated: Boolean(input.authenticated), verified: Boolean(input.verified) };
}

export function evaluateAuthorization({ principal = {}, action = 'read', resource = 'platform', sensitive = false } = {}) {
  const subject = normalizePrincipal(principal);
  const capability = String(action || '').trim();
  if (!subject.id) return { decision: 'deny', reason: 'principal_required', resource, action: capability };
  if (!subject.authenticated) return { decision: 'deny', reason: 'authentication_required', resource, action: capability };
  if (sensitive && !subject.verified) return { decision: 'review', reason: 'verification_required', resource, action: capability };
  const allowed = permissions[subject.role]?.includes('*') || permissions[subject.role]?.includes(capability);
  return { decision: allowed ? 'allow' : 'deny', reason: allowed ? 'authorization_granted' : 'permission_denied', resource, action: capability, role: subject.role };
}

export function authorizeRequest({ principal = {}, service = '', action = '', resource, sensitive = false, destructive = false, payment = false, correlationId = null } = {}) {
  const slug = String(service || '').trim();
  const capability = String(action || '').trim();
  const target = String(resource || (slug ? `service:${slug}` : 'platform')).trim();
  const elevated = Boolean(sensitive || destructive || payment);
  const authorization = evaluateAuthorization({ principal, action: capability, resource: target, sensitive: elevated });
  return {
    ...authorization,
    service: slug || null,
    resource: target,
    correlationId: correlationId || null,
    gate: 'FORTRESS',
    sideEffects: false,
    decisionValid: isFortressDecision(authorization.decision)
  };
}

export function isFortressDecision(value) { return decisions.has(value); }
export function fortressRoles() { return [...roles]; }
export function fortressPermissions() { return Object.fromEntries(Object.entries(permissions).map(([role, values]) => [role, [...values]])); }
