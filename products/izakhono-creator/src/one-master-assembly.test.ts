import assert from 'node:assert/strict';
import { planOneWorkflow } from './one-workflow';
import { buildMasterForTest } from './one-master-assembly-testable';

const plan = planOneWorkflow({
  id: 'brief_master_test',
  instruction: 'Create an Amapiano music video with voiceover and social delivery.',
  audience: 'South African young adults',
  language: 'English',
  channels: ['TikTok', 'Instagram'],
});

const blocked = buildMasterForTest(plan);
assert.equal(blocked.status, 'blocked');
assert.equal(blocked.qa.passed, false);
assert.equal(blocked.delivery.publicLive, false);

const completed = {
  ...plan,
  artifacts: plan.artifacts.map((artifact, index) => artifact.kind === 'brief'
    ? artifact
    : { ...artifact, status: 'completed' as const, evidence: `test-evidence-${index}` }),
};
const ready = buildMasterForTest(completed);
assert.equal(ready.status, 'ready');
assert.equal(ready.qa.passed, true);
assert.equal(ready.delivery.manifestReady, true);

console.log('IZAKHONO ONE master assembly: PASS');
