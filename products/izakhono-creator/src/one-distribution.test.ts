import assert from 'node:assert/strict';
import { planOneWorkflow } from './one-workflow';
import { buildMaster } from './one-master-assembly';
import { buildDistribution } from './one-distribution';

const plan = planOneWorkflow({ id: 'distribution_test', instruction: 'Create a social video campaign for TikTok and Instagram.', channels: ['TikTok', 'Instagram'] });
const masterBlocked = buildMaster(plan);
const blocked = buildDistribution(plan, masterBlocked);
assert.equal(blocked.status, 'blocked');
assert.equal(blocked.publicLive, false);

const completedPlan = {
  ...plan,
  artifacts: plan.artifacts.map((artifact, index) => artifact.kind === 'brief'
    ? artifact
    : { ...artifact, status: 'completed' as const, evidence: `evidence-${index}` }),
};
const masterReady = { ...buildMaster(completedPlan), status: 'approved' as const };
const ready = buildDistribution(completedPlan, masterReady);
assert.equal(ready.status, 'ready');
assert.deepEqual(ready.channels, ['TikTok', 'Instagram']);
assert.equal(ready.publicLive, false);
assert.equal(ready.approvalRequired, 'distribution');
assert.equal(ready.publishAdapters.TikTok, 'not-configured');

console.log('IZAKHONO ONE distribution gate: PASS');
