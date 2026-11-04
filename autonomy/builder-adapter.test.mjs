import assert from 'node:assert/strict';
import { runBuilderAdapter } from './builder-adapter.mjs';

process.env.IZAKHONO_BUILDER_PREFER_EXTERNAL = 'true';
process.env.IZAKHONO_BUILDER_ADAPTER_URL = 'http://127.0.0.1:1/should-never-be-called';

const result = await runBuilderAdapter({
  id: 'native-only-test',
  planId: 'native-only-test',
  title: 'Verify unsupported generation remains an explicit capability wait',
  action: 'model-generate',
});

assert.equal(result.status, 'waiting');
assert.equal(result.provider, 'izakhono-native');
assert.equal(result.executionModel, 'credits-free-capability-and-evidence');
console.log(JSON.stringify({ status: 'passed', provider: result.provider, externalBuilderCalled: false }));
