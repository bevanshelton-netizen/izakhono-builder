import assert from 'node:assert/strict';
import { provisionLocalModelRuntime, verifyLocalModelRuntime } from './provision.mjs';

let started = false;
const runCommand = (command, args) => {
  assert.equal(command, 'docker');
  assert.ok(args.includes('up'));
  started = true;
};
const fetchImpl = async () => ({
  ok: true,
  json: async () => ({ models: [{ name: 'qwen2.5-coder:3b' }] }),
});
const result = await provisionLocalModelRuntime({ runCommand, fetchImpl, attempts: 1, wait: async () => {} });
assert.equal(started, true);
assert.equal(result.status, 'verified');
assert.equal(result.model, 'qwen2.5-coder:3b');
const missing = await verifyLocalModelRuntime({ fetchImpl: async () => ({ ok: true, json: async () => ({ models: [] }) }) });
assert.equal(missing.status, 'waiting');
assert.equal(missing.reason, 'required-model-not-installed');
console.log('[PASS] Software NODE model-runtime provisioning and model-presence verification.');
