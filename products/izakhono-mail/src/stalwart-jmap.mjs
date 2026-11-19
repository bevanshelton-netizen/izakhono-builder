import { isIP } from 'node:net';

const JMAP_CAPABILITIES = ['urn:ietf:params:jmap:core', 'urn:stalwart:jmap'];
const MAX_RESPONSE_BYTES = 1024 * 1024;
const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const LOCAL_RE = /^[a-z0-9.!#$%&'*+\/=?^_{|}~-]{1,64}$/i;

function privateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host) && !host.includes('.')) return true;
  const family = isIP(host);
  if (family === 4) {
    const [a, b] = host.split('.').map(Number);
    return a === 10 || a === 127 || (a === 192 && b === 168)
      || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)
      || (a === 100 && b >= 64 && b <= 127);
  }
  if (family === 6) return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
  return false;
}

function validateAddress(domain, mailbox) {
  const canonicalDomain = String(domain || '').trim().toLowerCase().replace(/\.$/, '');
  const local = String(mailbox || '').trim().toLowerCase();
  if (!DOMAIN_RE.test(canonicalDomain)) throw new Error('stalwart-domain-invalid');
  if (!LOCAL_RE.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    throw new Error('stalwart-mailbox-local-part-invalid');
  }
  return { domain: canonicalDomain, mailbox: local, address: local + '@' + canonicalDomain };
}

function resultFor(methodResponses, method) {
  if (!Array.isArray(methodResponses)) throw new Error('stalwart-jmap-response-invalid');
  const entry = methodResponses.find((item) => Array.isArray(item) && item[0] === method && item[2] === 'izakhono');
  if (!entry) {
    const failure = methodResponses.find((item) => Array.isArray(item) && item[0] === 'error');
    throw new Error('stalwart-jmap-method-failed:' + String(failure?.[1]?.type || 'missing-response'));
  }
  return entry[1] || {};
}

export class StalwartJmapTransport {
  constructor({ baseUrl, username, password, fetchImpl = globalThis.fetch, timeoutMs = 10000, acmeProviderId = '' }) {
    if (!baseUrl || !username || !password || typeof fetchImpl !== 'function') {
      throw new Error('stalwart-jmap-configuration-required');
    }
    let url;
    try { url = new URL(baseUrl); } catch { throw new Error('stalwart-jmap-url-invalid'); }
    if (!['http:', 'https:'].includes(url.protocol) || !privateHost(url.hostname)
      || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
      throw new Error('stalwart-jmap-endpoint-must-be-private');
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
      throw new Error('stalwart-jmap-timeout-invalid');
    }
    this.endpoint = new URL('/jmap/', url.origin).toString();
    this.authorization = 'Basic ' + Buffer.from(String(username) + ':' + String(password), 'utf8').toString('base64');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.acmeProviderId = String(acmeProviderId || '').trim();
  }

  async call(method, args) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          authorization: this.authorization,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ using: JMAP_CAPABILITIES, methodCalls: [[method, args, 'izakhono']] }),
        signal: controller.signal,
      });
      const raw = await response.text();
      if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('stalwart-jmap-response-too-large');
      if (!response.ok) throw new Error('stalwart-jmap-http-' + response.status);
      let body;
      try { body = JSON.parse(raw); } catch { throw new Error('stalwart-jmap-response-invalid'); }
      return resultFor(body.methodResponses, method);
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('stalwart-jmap-timeout');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async ensureDomain(domain) {
    const canonical = String(domain || '').trim().toLowerCase().replace(/\.$/, '');
    if (!DOMAIN_RE.test(canonical)) throw new Error('stalwart-domain-invalid');
    const query = await this.call('x:Domain/query', { filter: { name: canonical } });
    let domainId = Array.isArray(query.ids) ? query.ids[0] : null;
    let created = false;

    if (!domainId) {
      const certificateManagement = this.acmeProviderId
        ? { '@type': 'Automatic', acmeProviderId: this.acmeProviderId, subjectAlternativeNames: { mail: true } }
        : { '@type': 'Manual' };
      const create = await this.call('x:Domain/set', {
        create: {
          izakhonoDomain: {
            name: canonical,
            aliases: {},
            certificateManagement,
            dkimManagement: { '@type': 'Automatic' },
            dnsManagement: { '@type': 'Manual' },
            subAddressing: { '@type': 'Enabled' },
          },
        },
      });
      domainId = create.created?.izakhonoDomain?.id || null;
      if (!domainId) {
        const failure = create.notCreated?.izakhonoDomain;
        if (failure) throw new Error('stalwart-domain-create-failed:' + String(failure.type || 'rejected'));
        const retry = await this.call('x:Domain/query', { filter: { name: canonical } });
        domainId = Array.isArray(retry.ids) ? retry.ids[0] : null;
      } else {
        created = true;
      }
    }
    if (!domainId) throw new Error('stalwart-domain-not-found-after-create');
    const fetched = await this.call('x:Domain/get', { ids: [domainId] });
    const record = Array.isArray(fetched.list) ? fetched.list.find((item) => item.id === domainId) : null;
    if (!record || record.name !== canonical) throw new Error('stalwart-domain-verification-failed');
    return {
      domainId,
      domain: canonical,
      created,
      dnsZoneFile: typeof record.dnsZoneFile === 'string' ? record.dnsZoneFile : '',
      certificateManagement: record.certificateManagement || null,
      dkimManagement: record.dkimManagement || null,
    };
  }

  async createMailbox({ domain, mailbox, password, displayName = '' }) {
    const target = validateAddress(domain, mailbox);
    if (typeof password !== 'string' || password.length < 16 || password.length > 256) {
      throw new Error('stalwart-mailbox-password-invalid');
    }
    const domainState = await this.ensureDomain(target.domain);
    const query = await this.call('x:Account/query', {
      filter: { name: target.mailbox, domainId: domainState.domainId },
    });
    const existingId = Array.isArray(query.ids) ? query.ids[0] : null;
    if (existingId) {
      return {
        created: false,
        state: 'credentials_recovery_required',
        address: target.address,
        domainId: domainState.domainId,
        accountId: existingId,
        dnsZoneFile: domainState.dnsZoneFile,
      };
    }

    const created = await this.call('x:Account/set', {
      create: {
        izakhonoMailbox: {
          '@type': 'User',
          name: target.mailbox,
          domainId: domainState.domainId,
          description: String(displayName || target.address).trim().slice(0, 200),
          credentials: { '0': { '@type': 'Password', secret: password } },
          aliases: {},
          memberGroupIds: {},
          roles: { '@type': 'User' },
          permissions: { '@type': 'Inherit' },
          quotas: {},
          encryptionAtRest: { '@type': 'Disabled' },
        },
      },
    });
    const accountId = created.created?.izakhonoMailbox?.id || null;
    if (!accountId) {
      const failure = created.notCreated?.izakhonoMailbox;
      if (failure?.type === 'alreadyExists') {
        const retry = await this.call('x:Account/query', {
          filter: { name: target.mailbox, domainId: domainState.domainId },
        });
        const id = Array.isArray(retry.ids) ? retry.ids[0] : null;
        if (id) return {
          created: false, state: 'credentials_recovery_required', address: target.address,
          domainId: domainState.domainId, accountId: id, dnsZoneFile: domainState.dnsZoneFile,
        };
      }
      throw new Error('stalwart-mailbox-create-failed:' + String(failure?.type || 'rejected'));
    }
    return {
      created: true,
      state: 'mailbox_created',
      address: target.address,
      domainId: domainState.domainId,
      accountId,
      dnsZoneFile: domainState.dnsZoneFile,
    };
  }
}

export function createStalwartTransportFromEnv(env = process.env, options = {}) {
  return new StalwartJmapTransport({
    baseUrl: env.STALWART_JMAP_URL,
    username: env.STALWART_ADMIN_USERNAME,
    password: env.STALWART_ADMIN_PASSWORD,
    timeoutMs: Number(env.STALWART_JMAP_TIMEOUT_MS || 10000),
    acmeProviderId: env.STALWART_ACME_PROVIDER_ID || '',
    ...options,
  });
}
