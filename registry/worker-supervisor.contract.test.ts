import {strict as assert} from 'node:assert';
import {WORKERS,WORKER_INDEX} from './workers';
import {classifyBuilderIssue} from './builder-queue';

const ids=WORKERS.map(w=>w.id);
assert.equal(new Set(ids).size,ids.length,'worker IDs must be unique');
assert.ok(WORKER_INDEX['task-dispatcher']);
assert.ok(WORKER_INDEX['build-worker']);
assert.ok(WORKER_INDEX['deployment-worker']);
assert.ok(WORKER_INDEX['provision-worker']);

const control=classifyBuilderIssue({number:359,title:'P0: Build IZAKHONO Control Plane',state:'open'});
assert.equal(control.workerId,'portfolio-orchestrator');
assert.equal(control.risk,'medium');
assert.equal(control.humanGate,'infrastructure_change');

const dispatch=classifyBuilderIssue({number:367,title:'WORKER SUPERVISOR: route outstanding IZAKHONO jobs to completion',state:'open'});
assert.equal(dispatch.workerId,'task-dispatcher');
assert.deepEqual(dispatch.dependencyIds,['359']);

const domain=classifyBuilderIssue({number:337,title:'IZAKHONO Domain live MVP',state:'open'});
assert.equal(domain.workerId,'provision-worker');
assert.equal(domain.risk,'high');
assert.equal(domain.humanGate,'domain_registration');

for(const worker of WORKERS){
  assert.equal(worker.reversible,true,`${worker.id} must remain reversible`);
  assert.ok(worker.inputs.includes('job_input'),`${worker.id} missing job_input`);
  assert.ok(worker.outputs.includes('job_output'),`${worker.id} missing job_output`);
  if(worker.risk==='high') assert.ok(worker.humanGate,`${worker.id} high-risk worker requires a human gate`);
}

console.log(`worker supervisor contract tests: ok (${WORKERS.length} workers)`);
