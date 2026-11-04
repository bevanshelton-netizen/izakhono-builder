/* IZAKHONO NAV — Driver Companion AI Provider Adapter
 * Server-side only. Do not expose IZAKHONO_AI_API_KEY to browser code.
 */
(function (root) {
  'use strict';

  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
  const endpoint = env.IZAKHONO_AI_CHAT_ENDPOINT || '';
  const apiKey = env.IZAKHONO_AI_API_KEY || '';
  const model = env.IZAKHONO_AI_MODEL || '';
  const configuredTimeoutMs = Number(env.IZAKHONO_AI_TIMEOUT_MS || 12000);
  const timeoutMs = Number.isFinite(configuredTimeoutMs)
    ? Math.min(Math.max(configuredTimeoutMs, 3000), 30000)
    : 12000;
  const MAX_MESSAGES = 12;
  const MAX_TEXT = 2000;
  const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;

  function validEndpoint(value) {
    try {
      const url = new URL(value);
      if (url.username || url.password || url.hash) return false;
      if (url.protocol === 'https:') return Boolean(url.hostname);
      return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
    } catch (_) { return false; }
  }

  function isJsonContentType(value) {
    return /^application\\/(?:[a-z0-9.+-]*\\+)?json(?:\\s*;|$)/i.test(String(value || '').trim());
  }

  async function readProviderJson(response) {
    const declaredLength = Number(response.headers && response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
      if (response.body && typeof response.body.cancel === 'function') await response.body.cancel().catch(function () {});
      throw new Error('AI provider response exceeded size limit');
    }
    if (!response.body || typeof response.body.getReader !== 'function') {
      throw new Error('AI provider response stream unavailable');
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > MAX_PROVIDER_RESPONSE_BYTES) {
          await reader.cancel().catch(function () {});
          throw new Error('AI provider response exceeded size limit');
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    chunks.forEach(function (chunk) { bytes.set(chunk, offset); offset += chunk.byteLength; });
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }

  const SYSTEM_PROMPT = [
    'You are the conversational driver companion for IZAKHONO NAV.',
    'The driver deliberately activated the conversation. Never initiate unsolicited conversation.',
    'Be calm, concise and natural because the user may be driving.',
    'Do not diagnose fatigue or a medical condition.',
    'If the driver says they are falling asleep, cannot keep their eyes open, or are unable to drive safely, advise them to slow down safely and stop at the nearest safe location as soon as practical.',
    'Never claim that police, emergency services, a rescue team or a human safety contact has been notified unless an authenticated integration explicitly confirms it.',
    'Never control the vehicle, engine, brakes or steering.',
    'Ask at most one short safety-relevant question at a time.',
    'Do not request unnecessary personal information.',
    'Return a short spoken response suitable for text-to-speech.'
  ].join(' ');

  function unavailable(message) {
    return {
      ok: false,
      provider: 'UNAVAILABLE',
      text: message || 'I’m here. Voice AI is currently unavailable.',
      safety_state: 'NORMAL',
      recommended_action: 'NONE'
    };
  }

  function safetyState(text) {
    const value = String(text || '').toLowerCase();
    if (/falling asleep|about to fall asleep|cannot keep.*eyes|can.?t keep.*eyes|not safe to drive|too tired to drive/.test(value)) {
      return 'FATIGUE_HIGH';
    }
    if (/tired|sleepy|fatigue|drowsy|exhausted/.test(value)) return 'FATIGUE_SUSPECTED';
    return 'NORMAL';
  }

  function normalizeMessages(input) {
    const messages = Array.isArray(input && input.messages) ? input.messages.slice(-MAX_MESSAGES) : [];
    return messages.map(function (m) {
      const role = m && (m.role === 'user' || m.role === 'assistant') ? m.role : null;
      if (!role) return null;
      return { role, content: String(m.content || '').slice(0, MAX_TEXT) };
    }).filter(Boolean);
  }

  async function chat(input) {
    if (!endpoint || !apiKey) {
      return unavailable('I’m here. The live voice service is not connected yet.');
    }

    if (!validEndpoint(endpoint)) return unavailable('I’m here. The voice service endpoint is not configured safely.');

    const messages = normalizeMessages(input);
    const lastUserText = [...messages].reverse().find(function (m) { return m.role === 'user'; });
    const state = safetyState(lastUserText && lastUserText.content);
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: model || undefined,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }].concat(messages),
          temperature: 0.3,
          max_tokens: 180
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.body && typeof response.body.cancel === 'function') await response.body.cancel().catch(function () {});
        throw new Error('AI provider returned HTTP ' + response.status);
      }
      const contentType = String(response.headers && response.headers.get('content-type') || '').toLowerCase();
      if (!isJsonContentType(contentType)) {
        if (response.body && typeof response.body.cancel === 'function') await response.body.cancel().catch(function () {});
        throw new Error('AI provider returned an unsupported content type');
      }

      const data = await readProviderJson(response);
      const text = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';

      if (!text) throw new Error('AI provider returned no assistant text');

      return {
        ok: true,
        provider: 'LIVE',
        text: String(text).trim().slice(0, MAX_TEXT),
        safety_state: state,
        recommended_action: state === 'FATIGUE_HIGH' ? 'SAFE_STOP' : 'NONE',
        request_id: response.headers.get('x-request-id') || null
      };
    } finally {
      clearTimeout(timer);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { chat, validEndpoint, readProviderJson, isJsonContentType };
  }
  if (root) root.IZAKHONO_NAV_AI_PROVIDER = { chat };
})(typeof window !== 'undefined' ? window : globalThis);
