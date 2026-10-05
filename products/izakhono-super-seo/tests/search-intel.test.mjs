import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchResult, providerStatus } from '../search-provider.mjs';
import { buildSearchOpportunities } from '../server.mjs';

test('provider does not invent metrics', () => {
  const r = normalizeSearchResult({ results: [{ position: 1, title: 'Example', url: 'https://example.com/x' }] }, 'example');
  assert.equal(r.metrics, undefined);
  assert.equal(r.results[0].position, 1);
});

test('provider status is unconfigured without credentials', () => {
  const s = providerStatus({});
  assert.equal(s.configured, false);
});

test('gap scoring identifies competitor presence without owned presence', () => {
  const rows = buildSearchOpportunities('izakhono.co.za', ['competitor.co.za'], [{
    query: 'uniform supplier south africa',
    source: 'test-provider',
    results: [{ position: 1, domain: 'competitor.co.za', url: 'https://competitor.co.za/uniforms' }]
  }]);
  assert.equal(rows[0].competitor_gap, true);
  assert.equal(rows[0].owned_position, null);
  assert.ok(rows[0].opportunity >= 70);
});

test('owned result is not a competitor gap', () => {
  const rows = buildSearchOpportunities('izakhono.co.za', ['competitor.co.za'], [{
    query: 'uniform supplier south africa',
    results: [{ position: 3, domain: 'izakhono.co.za', url: 'https://izakhono.co.za/uniforms' }]
  }]);
  assert.equal(rows[0].competitor_gap, false);
  assert.equal(rows[0].owned_position, 3);
});
