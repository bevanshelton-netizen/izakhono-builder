import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { requireOrganisation, requireRoles } from './auth.js';

test('organisation scope denies cross-organisation access', async () => {
  const app = Fastify();
  app.get('/', async (req, reply) => {
    (req as any).auth = { authenticated: true, organisationId: 'org-a', role: 'ORG_ADMIN', scopes: [] };
    return requireOrganisation(req, reply, 'org-b') ?? { ok: true };
  });
  const response = await app.inject({ method: 'GET', url: '/' });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, 'organisation_scope_violation');
  await app.close();
});

test('authorised organisation role is accepted', async () => {
  const app = Fastify();
  app.get('/', async (req, reply) => {
    (req as any).auth = { authenticated: true, organisationId: 'org-a', role: 'ORG_ADMIN', scopes: [] };
    return requireRoles(req, reply, ['ORG_ADMIN']) ?? { ok: true };
  });
  const response = await app.inject({ method: 'GET', url: '/' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
  await app.close();
});

test('unauthorised role is rejected', async () => {
  const app = Fastify();
  app.get('/', async (req, reply) => {
    (req as any).auth = { authenticated: true, organisationId: 'org-a', role: 'FAN', scopes: [] };
    return requireRoles(req, reply, ['ORG_ADMIN']) ?? { ok: true };
  });
  const response = await app.inject({ method: 'GET', url: '/' });
  assert.equal(response.statusCode, 403);
  await app.close();
});
