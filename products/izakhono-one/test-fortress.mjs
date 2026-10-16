import { evaluateAuthorization, fortressPermissions, fortressRoles } from './services/fortress.mjs';

if (fortressRoles().length !== 5) throw new Error('FORTRESS role registry failed');
if (!fortressPermissions().owner.includes('*')) throw new Error('owner permission boundary failed');

const missing = evaluateAuthorization({ action: 'read' });
if (missing.decision !== 'deny' || missing.reason !== 'principal_required') throw new Error('principal fail-closed gate failed');

const unauthenticated = evaluateAuthorization({ principal: { id: 'u1', role: 'member' }, action: 'read' });
if (unauthenticated.decision !== 'deny' || unauthenticated.reason !== 'authentication_required') throw new Error('authentication gate failed');

const member = evaluateAuthorization({ principal: { id: 'u1', role: 'member', authenticated: true, verified: true }, action: 'read' });
if (member.decision !== 'allow') throw new Error('member read authorization failed');

const denied = evaluateAuthorization({ principal: { id: 'u1', role: 'member', authenticated: true, verified: true }, action: 'execute' });
if (denied.decision !== 'deny' || denied.reason !== 'permission_denied') throw new Error('RBAC deny boundary failed');

const review = evaluateAuthorization({ principal: { id: 'u2', role: 'operator', authenticated: true, verified: false }, action: 'execute', sensitive: true });
if (review.decision !== 'review' || review.reason !== 'verification_required') throw new Error('sensitive verification gate failed');

const operator = evaluateAuthorization({ principal: { id: 'u2', role: 'operator', authenticated: true, verified: true }, action: 'execute', sensitive: true });
if (operator.decision !== 'allow') throw new Error('verified operator authorization failed');

console.log('IZAKHONO ONE FORTRESS authorization tests: PASS');
