import assert from 'node:assert/strict';
import { StalwartJmapTransport } from './stalwart-jmap.mjs';

function mockFetch(responses) {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push({ request, authorization: options.headers.authorization });
    const [method, , tag] = request.methodCalls[0];
    const response = responses.shift();
    assert.ok(response, 'unexpected JMAP request: ' + method);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ methodResponses: [[method, response, tag]] }),
    };
  };
  return { fetchImpl, calls };
}

const domainRecord = {
  id: 'domain-1',
  name: 'example.test',
  dnsZoneFile: 'example.test. 3600 IN MX 10 mail.example.test.\n',
  dkimManagement: { '@type': 'Automatic' },
};

{
  const { fetchImpl, calls } = mockFetch([
    { ids: [] },
    { created: { izakhonoDomain: { id: 'domain-1' } } },
    { list: [domainRecord] },
    { ids: [] },
    { created: { izakhonoMailbox: { id: 'account-1' } } },
  ]);
  const transport = new StalwartJmapTransport({
    baseUrl: 'http://mailserver:8080',
    username: 'admin',
    password: 'not-a-real-secret',
    fetchImpl,
  });
  const result = await transport.createMailbox({
    domain: 'example.test',
    mailbox: 'info',
    password: 'a-long-generated-password-value',
    displayName: 'Example Information',
  });
  assert.equal(result.created, true);
  assert.equal(result.state, 'mailbox_created');
  assert.equal(result.address, 'info@example.test');
  assert.equal(result.accountId, 'account-1');
  assert.match(result.dnsZoneFile, /MX 10 mail\.example\.test/);
  assert.equal(calls.length, 5);
  assert.equal(calls[0].request.methodCalls[0][0], 'x:Domain/query');
  assert.equal(calls[1].request.methodCalls[0][0], 'x:Domain/set');
  assert.equal(calls[2].request.methodCalls[0][0], 'x:Domain/get');
  assert.equal(calls[3].request.methodCalls[0][0], 'x:Account/query');
  assert.equal(calls[4].request.methodCalls[0][0], 'x:Account/set');
  assert.equal(calls[4].request.methodCalls[0][1].create.izakhonoMailbox.credentials['0'].secret, 'a-long-generated-password-value');
  assert.match(calls[0].authorization, /^Basic /);
}

{
  const { fetchImpl } = mockFetch([
    { ids: ['domain-1'] },
    { list: [domainRecord] },
    { ids: ['account-1'] },
  ]);
  const transport = new StalwartJmapTransport({
    baseUrl: 'http://127.0.0.1:18081',
    username: 'admin',
    password: 'not-a-real-secret',
    fetchImpl,
  });
  const result = await transport.createMailbox({
    domain: 'example.test', mailbox: 'info', password: 'a-long-generated-password-value',
  });
  assert.equal(result.created, false);
  assert.equal(result.state, 'credentials_recovery_required');
  assert.equal(result.accountId, 'account-1');
}

assert.throws(() => new StalwartJmapTransport({
  baseUrl: 'https://mail.example.com',
  username: 'admin',
  password: 'not-a-real-secret',
  fetchImpl: async () => { throw new Error('must-not-run'); },
}), /must-be-private/);

assert.throws(() => new StalwartJmapTransport({
  baseUrl: 'http://127.0.0.1:11434/api/chat',
  username: 'admin',
  password: 'not-a-real-secret',
  fetchImpl: async () => { throw new Error('must-not-run'); },
}), /must-be-private/);

console.log('[PASS] Stalwart JMAP private endpoint, domain creation, mailbox creation and idempotent recovery verified.');
