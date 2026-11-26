export function createProviderHttpClient({ baseUrl, token, fetchImpl = fetch, timeoutMs = 30000 }) {
  if (typeof baseUrl !== 'string' || !baseUrl || typeof token !== 'string' || !token) throw new Error('PROVIDER_CONFIGURATION_REQUIRED');
  const base = new URL(baseUrl);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.protocol !== 'https:' && !loopback) throw new Error('PROVIDER_HTTPS_REQUIRED');
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('PROVIDER_BASE_URL_INVALID');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) throw new Error('PROVIDER_TIMEOUT_INVALID');

  return Object.freeze({
    async request(method, pathname, body, signal) {
      if (!['GET', 'POST'].includes(method) || typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) {
        throw new Error('PROVIDER_REQUEST_CONTRACT_INVALID');
      }
      const timeout = AbortSignal.timeout(timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      let response;
      try {
        response = await fetchImpl(new URL(pathname, base), {
          method,
          headers: {
            authorization: 'Bearer ' + token,
            'content-type': 'application/json',
            'cache-control': 'no-store'
          },
          ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
          signal: combined
        });
      } catch {
        const error = new Error('PROVIDER_TRANSPORT_FAILED');
        error.code = 'PROVIDER_TRANSPORT_FAILED';
        error.statusCode = 503;
        throw error;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error('PROVIDER_HTTP_REQUEST_FAILED');
        error.code = 'PROVIDER_HTTP_' + response.status;
        error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 503;
        throw error;
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        const error = new Error('PROVIDER_RESPONSE_INVALID');
        error.code = 'PROVIDER_RESPONSE_INVALID';
        error.statusCode = 502;
        throw error;
      }
      return data;
    }
  });
}
