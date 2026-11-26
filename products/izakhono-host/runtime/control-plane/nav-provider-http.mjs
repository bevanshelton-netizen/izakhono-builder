const METHODS = new Set(['provision', 'inspect', 'stop', 'replace', 'backup', 'restore']);

export function createHttpNavProvider({ baseUrl, token, fetchImpl = fetch, timeoutMs = 30000 }) {
  if (!baseUrl || !token) throw new Error('NAV_PROVIDER_CONFIGURATION_REQUIRED');
  const base = new URL(baseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.protocol !== 'https:' && !local) throw new Error('NAV_PROVIDER_HTTPS_REQUIRED');
  if (base.username || base.password || base.search || base.hash) throw new Error('NAV_PROVIDER_URL_INVALID');

  return Object.fromEntries([...METHODS].map(method => [method, async payload => {
    const response = await fetchImpl(new URL('/v1/workloads/nav/' + method, base), {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + token,
        'content-type': 'application/json',
        'cache-control': 'no-store'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error('NAV_PROVIDER_REQUEST_FAILED');
      error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 503;
      error.code = 'NAV_PROVIDER_' + response.status;
      throw error;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      const error = new Error('NAV_PROVIDER_INVALID_RESPONSE');
      error.statusCode = 502;
      throw error;
    }
    return data;
  }]));
}
