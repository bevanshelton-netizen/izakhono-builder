import assert from 'node:assert/strict';
import { Engine, getEngine, listEngines } from './engine-runtime.mjs';

assert.equal(listEngines().length, 8);
const storage = getEngine('storage');
assert.ok(storage);
assert.equal(storage.health().status, 'READY');
assert.ok(storage.capabilities().includes('object.put'));
const plan = storage.plan({ action: 'bucket.create', name: 'test' });
assert.equal(plan.status, 'PLANNED');
const result = storage.execute(plan.command);
assert.equal(result.status, 'EXECUTED');
assert.equal(storage.verify(result).verified, true);
assert.equal(new Engine('x').rollback({ id: 'demo' }).status, 'ROLLBACK_REQUESTED');
console.log('ENGINE FABRIC TESTS: PASS');
