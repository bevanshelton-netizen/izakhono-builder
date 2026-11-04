'use strict';
const assert = require('node:assert/strict');
const { validEndpoint, readProviderJson, isJsonContentType } = require('./driver-companion-ai-provider');

async function main() {
  assert.equal(validEndpoint('https://api.example.com/v1/chat/completions'), true);
  assert.equal(validEndpoint('http://localhost:8080/chat'), true);
  assert.equal(validEndpoint('http://api.example.com/chat'), false);
  assert.equal(validEndpoint('ftp://api.example.com/chat'), false);
  assert.equal(validEndpoint('https://user:pass@api.example.com/chat'), false);
  assert.equal(validEndpoint('https://api.example.com/chat#fragment'), false);
  assert.equal(isJsonContentType('application/json'), true);
  assert.equal(isJsonContentType('application/json; charset=utf-8'), true);
  assert.equal(isJsonContentType('application/vnd.api+json'), true);
  assert.equal(isJsonContentType('text/html'), false);
  assert.equal(isJsonContentType('application/javascript'), false);

  const okPayload = JSON.stringify({ choices: [{ message: { content: 'NAV provider test' } }] });
  const okResponse = new Response(okPayload, { headers: { 'content-type': 'application/json' } });
  const parsed = await readProviderJson(okResponse);
  assert.equal(parsed.choices[0].message.content, 'NAV provider test');

  const largeBody = new Uint8Array(65 * 1024);
  const largeResponse = new Response(largeBody);
  await assert.rejects(() => readProviderJson(largeResponse), /exceeded size limit/);

  const declaredLarge = new Response('{}', { headers: { 'content-length': String(65 * 1024) } });
  await assert.rejects(() => readProviderJson(declaredLarge), /exceeded size limit/);
  console.log('NAV AI provider security tests passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
