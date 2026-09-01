export class IzakhonoPayError extends Error {
  constructor(message, { status = 500, code = 'izakhono_pay_error', details = null } = {}) {
    super(message);
    this.name = 'IzakhonoPayError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function requireText(value, name) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new IzakhonoPayError(`${name} is required`, { status: 500, code: 'misconfigured' });
  return text;
}

export class IzakhonoPayClient {
  constructor({ baseUrl, apiKey, appSlug, fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = requireText(baseUrl, 'IZAKHONO_PAY_URL').replace(/\/$/, '');
    this.apiKey = requireText(apiKey, 'IZAKHONO_PAY_API_KEY');
    this.appSlug = requireText(appSlug, 'IZAKHONO_PAY_APP_SLUG');
    if (typeof fetchImpl !== 'function') throw new IzakhonoPayError('fetch implementation is required', { status: 500, code: 'misconfigured' });
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = 'GET', body, idempotencyKey } = {}) {
    const headers = {
      accept: 'application/json',
      'x-izakhono-key': this.apiKey,
      'x-izakhono-app': this.appSlug,
    };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (idempotencyKey) headers['idempotency-key'] = String(idempotencyKey);

    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
      });
    } catch (error) {
      throw new IzakhonoPayError('IZAKHONO PAY is temporarily unreachable', {
        status: 503,
        code: 'portal_unreachable',
        details: error instanceof Error ? error.message : null,
      });
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new IzakhonoPayError(payload?.error?.message || `IZAKHONO PAY rejected the request (${response.status})`, {
        status: response.status,
        code: payload?.error?.code || 'portal_error',
        details: payload,
      });
    }
    return payload;
  }

  async createIntent({ amountMinor, currency = 'ZAR', email, description, provider = 'smart', metadata = {}, idempotencyKey }) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new IzakhonoPayError('amountMinor must be a positive integer', { status: 422, code: 'invalid_amount' });
    }
    const payload = await this.request('/api/v1/intents', {
      method: 'POST',
      idempotencyKey,
      body: {
        amount_minor: amountMinor,
        currency,
        email,
        description,
        provider,
        app_slug: this.appSlug,
        metadata,
      },
    });
    return payload.intent;
  }

  async getIntent(intentId) {
    const id = encodeURIComponent(requireText(intentId, 'intentId'));
    const payload = await this.request(`/api/v1/intents/${id}`);
    return payload.intent;
  }
}

export function izakhonoPayFromEnv(env = process.env, options = {}) {
  return new IzakhonoPayClient({
    baseUrl: env.IZAKHONO_PAY_URL,
    apiKey: env.IZAKHONO_PAY_API_KEY,
    appSlug: env.IZAKHONO_PAY_APP_SLUG,
    ...options,
  });
}
