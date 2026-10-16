import { evaluateAuthorization, authorizeRequest, fortressPermissions, fortressRoles, fortressResourceScopes } from './services/fortress.mjs';

if (fortressRoles().length !== 5) throw new Error('FORTRESS role registry failed');
if (!fortressPermissions().owner.includes('*')) throw new Error('owner permission boundary failed');
if (!fortressResourceScopes().service.includes('operator')) throw new Error('service resource scope failed');

const missing = evaluateAuthorization({ action: 'read' });
if (missing.decision !== 'deny' || missing.reason !== 'principal_required') throw new Error('principal fail-closed gate failed');

const unauthenticated = evaluateAuthorization({ principal: { id: 'u1', role: 'member' }, action: 'read', resource: 'service:search' });
if (unauthenticated.decision !== 'deny' || unauthenticated.reason !== 'authentication_required') throw new Error('authentication gate failed');

const member = evaluateAuthorization({ principal: { id: 'u1', role: 'member', authenticated: true, verified: true }, action: 'read', resource: 'service:search' });
if (member.decision !== 'allow') throw new Error('member read authorization failed');

const denied = evaluateAuthorization({ principal: { id: 'u1', role: 'member', authenticated: true, verified: true }, action: 'execute', resource: 'service:search' });
if (denied.decision !== 'deny' || denied.reason !== 'permission_denied') throw new Error('RBAC deny boundary failed');

const review = evaluateAuthorization({ principal: { id: 'u2', role: 'operator', authenticated: true, verified: false }, action: 'execute', resource: 'service:search', sensitive: true });
if (review.decision !== 'review' || review.reason !== 'verification_required') throw new Error('sensitive verification gate failed');

const operator = evaluateAuthorization({ principal: { id: 'u2', role: 'operator', authenticated: true, verified: true }, action: 'execute', resource: 'service:search', sensitive: true });
if (operator.decision !== 'allow') throw new Error('verified operator authorization failed');

const unknown = evaluateAuthorization({ principal: { id: 'u2', role: 'operator', authenticated: true, verified: true }, action: 'read', resource: 'mystery:thing' });
if (unknown.decision !== 'deny' || unknown.reason !== 'resource_not_authorized') throw new Error('unknown resource fail-closed gate failed');

const audited = authorizeRequest({ principal: { id: 'u2', role: 'operator', authenticated: true, verified: true }, service: 'search', action: 'execute', resource: 'service:search', correlationId: 'corr-1' });
if (audited.decision !== 'allow' || audited.audit?.side_effects !== false || audited.audit?.correlation_id !== 'corr-1') throw new Error('audit event boundary failed');

console.log('IZAKHONO ONE FORTRESS authorization + audit tests: PASS');
