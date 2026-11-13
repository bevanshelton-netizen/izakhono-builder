import {strict as assert} from 'node:assert';
import {WORKERS,WORKER_INDEX} from './workers';
import {classifyBuilderIssue} from './builder-queue';
import {executeWorker,hasWorkerHandler,executableWorkerIds} from './worker-execution';

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

assert.equal(hasWorkerHandler('portfolio-orchestrator'),true);
assert.equal(hasWorkerHandler('task-dispatcher'),true);
assert.equal(hasWorkerHandler('evidence-collector'),true);
assert.equal(hasWorkerHandler('deployment-worker'),false,'unimplemented workers must not be advertised as executable');
assert.deepEqual(executableWorkerIds(),['evidence-collector','portfolio-orchestrator','task-dispatcher']);

const plan=await executeWorker(WORKER_INDEX['portfolio-orchestrator'],{goal:'Launch a controlled workflow',workstreams:['Define scope','Build vertical slice']});
assert.equal(plan.status,'executed');
assert.equal(plan.output.planStatus,'draft');
assert.equal((plan.output.workstreams as unknown[]).length,2);
assert.equal(plan.evidence.verified,false,'execution evidence must not self-verify');

const routing=await executeWorker(WORKER_INDEX['task-dispatcher'],{candidates:[
 {id:'a',workerId:'document-worker',status:'queued',risk:'low',dependenciesReady:true},
 {id:'b',workerId:'payment-worker',status:'queued',risk:'high',dependenciesReady:true},
 {id:'c',workerId:'build-worker',status:'queued',risk:'low',dependenciesReady:false}
]});
assert.equal((routing.output.eligible as unknown[]).length,1);
assert.equal((routing.output.withheld as unknown[]).length,2);
assert.equal(routing.output.dispatchesPerformed,0,'routing analysis must not claim to have dispatched jobs');

const evidence=await executeWorker(WORKER_INDEX['evidence-collector'],{evidence:[{id:'commit-1',kind:'git-commit',source:'github',observedAt:'2026-11-13T20:00:00Z'}]});
assert.equal(evidence.output.count,1);
assert.equal(evidence.output.verificationStatus,'unverified');
await assert.rejects(()=>executeWorker(WORKER_INDEX['evidence-collector'],{evidence:[]}),/at least one item/);

console.log(`worker supervisor contract tests: ok (${WORKERS.length} catalog workers; ${executableWorkerIds().length} executable handlers)`);
