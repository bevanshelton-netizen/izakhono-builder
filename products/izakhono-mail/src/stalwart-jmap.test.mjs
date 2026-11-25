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
    { ids: ['domain-1'] },
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
  assert.equal(calls.length, 4);
  assert.equal(calls[0].request.methodCalls[0][0], 'x:Domain/query');
  assert.equal(calls[1].request.methodCalls[0][0], 'x:Domain/get');
  assert.equal(calls[2].request.methodCalls[0][0], 'x:Account/query');
  assert.equal(calls[3].request.methodCalls[0][0], 'x:Account/set');
  assert.equal(calls[3].request.methodCalls[0][1].create.izakhonoMailbox.credentials['0'].secret, 'a-long-generated-password-value');
  assert.equal(calls[3].request.methodCalls[0][1].create.izakhonoMailbox['@type'], 'User');
  assert.deepEqual(calls[3].request.methodCalls[0][1].create.izakhonoMailbox.aliases, {});
  assert.deepEqual(calls[3].request.methodCalls[0][1].create.izakhonoMailbox.roles, { '@type': 'User' });
  assert.deepEqual(calls[3].request.methodCalls[0][1].create.izakhonoMailbox.permissions, { '@type': 'Inherit' });
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

{
  const { fetchImpl, calls } = mockFetch([
    { ids: ['domain-1'] },
    { list: [domainRecord] },
  ]);
  const transport = new StalwartJmapTransport({
    baseUrl: 'http://127.0.0.1:18081',
    apiKey: 'scoped-provisioner-token',
    fetchImpl,
  });
  const domain = await transport.ensureDomain('example.test');
  assert.equal(domain.domainId, 'domain-1');
  assert.equal(calls[0].authorization, 'Bearer scoped-provisioner-token');
}

{
  const { fetchImpl } = mockFetch([{ ids: [] }]);
  const transport = new StalwartJmapTransport({
    baseUrl: 'http://127.0.0.1:18081',
    apiKey: 'scoped-provisioner-token',
    fetchImpl,
  });
  await assert.rejects(() => transport.ensureDomain('example.test'), /domain-not-provisioned/);
}
