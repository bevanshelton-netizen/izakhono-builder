export async function readJsonBody(req, maxBytes = 32768) {
  const declared = Number(req.headers?.['content-length'] || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    const error = new Error('payload_too_large');
    error.statusCode = 413;
    throw error;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > maxBytes) {
      const error = new Error('payload_too_large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(part);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function createRateLimiter({ windowMs, limit, maxKeys = 10000, now = Date.now }) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new TypeError('windowMs_must_be_positive');
  if (!Number.isInteger(limit) || limit <= 0) throw new TypeError('limit_must_be_positive_integer');
  if (!Number.isInteger(maxKeys) || maxKeys <= 0) throw new TypeError('maxKeys_must_be_positive_integer');
  const entries = new Map();
  let calls = 0;
  return function allowed(req) {
    const key = String(req.socket?.remoteAddress || 'unknown').slice(0, 96);
    const time = now();
    if (++calls % 100 === 0) {
      for (const [address, timestamps] of entries) {
        const active = timestamps.filter((stamp) => time - stamp < windowMs);
        if (active.length) entries.set(address, active);
        else entries.delete(address);
      }
    }
    const active = (entries.get(key) || []).filter((stamp) => time - stamp < windowMs);
    if (active.length >= limit) return false;
    if (!entries.has(key) && entries.size >= maxKeys) return false;
    active.push(time);
    entries.set(key, active);
    return true;
  };
}
