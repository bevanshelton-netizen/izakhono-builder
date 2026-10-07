import {strict as assert} from 'node:assert';
import {classifyBuilderIssue} from './builder-queue';

const control=classifyBuilderIssue({number:359,title:'P0: Build IZAKHONO Control Plane',state:'open'});
assert.equal(control.priority,100);
assert.equal(control.workerId,'portfolio-orchestrator');
assert.equal(control.risk,'medium');

const domain=classifyBuilderIssue({number:337,title:'IZAKHONO Domain live MVP',state:'open'});
assert.equal(domain.workerId,'provision-worker');
assert.equal(domain.risk,'high');
assert.equal(domain.humanGate,'domain_registration');

const generic=classifyBuilderIssue({number:999,title:'Fix build tests',state:'open'});
assert.equal(generic.workerId,'build-worker');
assert.equal(generic.risk,'low');

console.log('builder queue classification tests: ok');
