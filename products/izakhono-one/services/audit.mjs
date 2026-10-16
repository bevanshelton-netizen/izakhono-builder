function clean(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function createAuditEvent({ principal = {}, service = null, resource = null, action = null, decision = 'deny', reason = 'unknown', sensitive = false, destructive = false, payment = false, correlationId = null } = {}) {
  return Object.freeze({
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    correlation_id: clean(correlationId) || crypto.randomUUID(),
    principal_id: clean(principal.id),
    role: clean(principal.role),
    authenticated: Boolean(principal.authenticated),
    verified: Boolean(principal.verified),
    service: clean(service),
    resource: clean(resource),
    action: clean(action),
    decision: clean(decision) || 'deny',
    reason: clean(reason) || 'unknown',
    sensitive: Boolean(sensitive),
    destructive: Boolean(destructive),
    payment: Boolean(payment),
    side_effects: false,
    mode: 'prepare_only'
  });
}
