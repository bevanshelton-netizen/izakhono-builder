import assert from 'node:assert/strict';
import {
  runOllamaChat,
  runWithModelFallback,
  selectModel,
  validateModelEndpoint,
  type ModelEndpoint,
} from './intelligence';

const local: ModelEndpoint = {
  id: 'local-qwen',
  provider: 'ollama',
  protocol: 'ollama-chat',
  model: 'qwen2.5-coder:3b',
  baseUrl: 'http://127.0.0.1:11434',
  trust: 'local',
  capabilities: ['chat', 'code', 'reasoning'],
  contextWindow: 8192,
  enabled: true,
  healthy: true,
  latencyMs: 120,
};
const ownerLocal: ModelEndpoint = {
  ...local,
  id: 'owner-node-qwen',
  provider: 'izakhono-node',
  baseUrl: 'http://10.20.0.8:11434',
  trust: 'owner',
  latencyMs: 220,
};
const external: ModelEndpoint = {
  ...local,
  id: 'external-code',
  provider: 'external-provider',
  protocol: undefined,
  model: 'external-model',
  baseUrl: 'https://inference.example.test/v1',
  trust: 'approved_external',
  estimatedCostPer1kTokens: 0.02,
};

assert.equal(validateModelEndpoint(local).baseUrl, 'http://127.0.0.1:11434');
assert.equal(validateModelEndpoint(ownerLocal).trust, 'owner');
assert.throws(() => validateModelEndpoint(external), /External inference endpoints are disabled/);
assert.throws(() => validateModelEndpoint({ ...local, baseUrl: 'http://inference.example.test' }), /private IZAKHONO address/);
assert.throws(() => validateModelEndpoint({ ...local, baseUrl: 'https://user:pass@example.test' }), /Credentials/);
assert.throws(() => validateModelEndpoint({ ...local, baseUrl: 'http://127.0.0.1:11434/api/chat' }), /without a path/);

const selected = selectModel([external, local], {
  task: 'code',
  estimatedInputTokens: 2048,
  policy: { allowedTrust: ['local', 'owner', 'approved_external'], requiredCapabilities: [], preferLocal: true },
});
assert.equal(selected.endpoint.id, 'local-qwen');

assert.throws(() => selectModel([external], {
  task: 'code',
  policy: { allowedTrust: ['approved_external'], requiredCapabilities: [] },
}), /No healthy private Ollama endpoint/);

assert.throws(() => selectModel([local], {
  task: 'vision',
  policy: { allowedTrust: ['local'], requiredCapabilities: [] },
}), /No healthy private Ollama endpoint/);

async function testOllamaAdapter() {
  let calledUrl = '';
  let requestBody: any;
  const inference = await runOllamaChat(local, {
    model: local.model,
    messages: [{ role: 'user', content: 'Write a TypeScript hello world.' }],
    max_tokens: 120,
  }, async (input, init) => {
    calledUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      message: { content: 'console.log("Hello, IZAKHONO");' },
      prompt_eval_count: 12,
      eval_count: 8,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  assert.equal(calledUrl, 'http://127.0.0.1:11434/api/chat');
  assert.equal(requestBody.stream, false);
  assert.equal(requestBody.model, 'qwen2.5-coder:3b');
  assert.match(inference.content, /Hello, IZAKHONO/);
  assert.equal(inference.inputTokens, 12);
  assert.equal(inference.outputTokens, 8);
}

async function testFallbackStaysInsideOwnedPrivateRuntime() {
  let externalCalls = 0;
  const routed = await runWithModelFallback([local, ownerLocal, external], {
    task: 'code',
    policy: { allowedTrust: ['local', 'owner', 'approved_external'], requiredCapabilities: [], preferLocal: true },
    model: 'qwen2.5-coder:3b',
    messages: [{ role: 'user', content: 'Review this code.' }],
  }, { list: async () => [local, ownerLocal, external], getSecret: async () => undefined }, async (input) => {
    if (String(input).includes('127.0.0.1')) return new Response('unavailable', { status: 503 });
    if (String(input).includes('example.test')) externalCalls += 1;
    return new Response(JSON.stringify({
      message: { content: 'Private fallback review complete.' },
      prompt_eval_count: 5,
      eval_count: 7,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  assert.equal(routed.content, 'Private fallback review complete.');
  assert.equal(routed.fallbackUsed, true);
  assert.equal(routed.attempts, 2);
  assert.equal(externalCalls, 0, 'external inference must never be attempted');

  let calls = 0;
  await assert.rejects(() => runWithModelFallback([local, external], {
    task: 'code',
    policy: { allowedTrust: ['local', 'approved_external'], requiredCapabilities: [], preferLocal: true },
    model: 'qwen2.5-coder:3b',
    messages: [{ role: 'user', content: 'Keep this local.' }],
  }, { list: async () => [local, external], getSecret: async () => undefined }, async () => {
    calls += 1;
    return new Response('unavailable', { status: 503 });
  }), /All eligible private Ollama endpoints failed/);
  assert.equal(calls, 1, 'only the local endpoint may be attempted');
}

async function main() {
  await testOllamaAdapter();
  await testFallbackStaysInsideOwnedPrivateRuntime();
  console.log('[PASS] IZAKHONO Intelligence is Ollama-only; external fallback is disabled.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
