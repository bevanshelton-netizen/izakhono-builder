import assert from 'node:assert/strict';
import { begin, createJob, evaluate, markPlanned, planProviders, recordEvidence, verifyLive } from './orchestrator';

const request = {
  requestId: 'req_demo_001',
  projectId: 'project_demo',
  name: 'Demo Platform',
  slug: 'demo-platform',
  requested: ['DATABASE', 'WEB', 'DOMAIN', 'DNS', 'TLS', 'SECURITY', 'DEPLOYMENT'] as const,
};

let job = createJob(request, '2026-10-29T00:00:00.000Z');
assert.equal(job.state, 'RECEIVED');
assert.equal(planProviders(['DATABASE'])[0].provider, 'IZAKHONO-DATA');
assert.equal(planProviders(['DATABASE'])[1].provider, 'SUPABASE');

job = markPlanned(job, '2026-10-29T00:01:00.000Z');
job = begin(job, '2026-10-29T00:02:00.000Z');
assert.equal(job.state, 'PROVISIONING');

for (const capability of request.requested) {
  job = recordEvidence(job, capability, 'PASSED', `evidence:${capability}`, job.providers.find(p => p.capability === capability && p.mode === 'PRIMARY')?.provider, undefined, '2026-10-29T00:03:00.000Z');
}

job = evaluate(job, '2026-10-29T00:04:00.000Z');
assert.equal(job.state, 'LIVE');
assert.equal(verifyLive(job), true);
console.log('autonomous control plane contract: PASS');
