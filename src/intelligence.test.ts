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
const external: ModelEndpoint = {
  ...local,
  id: 'external-code',
  provider: 'approved-provider',
  protocol: 'openai-chat-completions',
  model: 'code-model',
  baseUrl: 'https://inference.example.test/v1',
  trust: 'approved_external',
  estimatedCostPer1kTokens: 0.02,
};

assert.equal(validateModelEndpoint(local).baseUrl, 'http://127.0.0.1:11434');
assert.throws(() => validateModelEndpoint({ ...local, baseUrl: 'http://inference.example.test' }), /HTTPS/);
assert.throws(() => validateModelEndpoint({ ...local, baseUrl: 'https://user:pass@example.test' }), /Credentials/);

const selected = selectModel([external, local], {
  task: 'code',
  estimatedInputTokens: 2048,
  policy: { allowedTrust: ['local', 'owner'], requiredCapabilities: [], preferLocal: true },
});
assert.equal(selected.endpoint.id, 'local-qwen');

assert.throws(() => selectModel([local], {
  task: 'vision',
  policy: { allowedTrust: ['local'], requiredCapabilities: [] },
}), /No healthy model endpoint/);

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


async function testPolicyBoundedFallback() {
  const routed = await runWithModelFallback([local, external], {
    task: 'code',
    policy: { allowedTrust: ['local', 'approved_external'], requiredCapabilities: [], preferLocal: true },
    model: 'code-model',
    messages: [{ role: 'user', content: 'Review this code.' }],
  }, { list: async () => [local, external], getSecret: async () => undefined }, async (input) => {
    if (String(input).includes('127.0.0.1')) return new Response('unavailable', { status: 503 });
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'Fallback review complete.' } }],
      usage: { prompt_tokens: 5, completion_tokens: 7 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  assert.equal(routed.content, 'Fallback review complete.');
  assert.equal(routed.fallbackUsed, true);
  assert.equal(routed.attempts, 2);

  await assert.rejects(() => runWithModelFallback([local, external], {
    task: 'code',
    policy: { allowedTrust: ['local'], requiredCapabilities: [], preferLocal: true },
    model: 'qwen2.5-coder:3b',
    messages: [{ role: 'user', content: 'Keep this local.' }],
  }, { list: async () => [local], getSecret: async () => undefined }, async () => new Response('unavailable', { status: 503 })), /All eligible model endpoints failed/);
}

async function main() {
  await testOllamaAdapter();
  await testPolicyBoundedFallback();
  console.log('[PASS] IZAKHONO Intelligence routing, policy filtering and native Ollama adapter.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
