const DEFAULT_MODEL_URL = 'http://127.0.0.1:11434/api/chat';
const DEFAULT_MODEL = 'qwen2.5-coder:3b';
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 8000;
const MAX_TOTAL_LENGTH = 32000;

export class OneAIChatError extends Error {
  constructor(code, message, statusCode = 503) {
    super(message);
    this.name = 'OneAIChatError';
    this.code = code;
    this.statusCode = statusCode;
    this.publicMessage = message;
  }
}

export function validateChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) {
    throw new OneAIChatError('invalid_messages', 'Please send a shorter conversation.', 400);
  }
  let total = 0;
  const safe = messages.map((message) => {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') {
      throw new OneAIChatError('invalid_messages', 'The conversation contains an unsupported message.', 400);
    }
    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      throw new OneAIChatError('invalid_messages', 'Each message must contain between 1 and 8,000 characters.', 400);
    }
    total += content.length;
    return { role: message.role, content };
  });
  if (total > MAX_TOTAL_LENGTH || safe[safe.length - 1].role !== 'user') {
    throw new OneAIChatError('invalid_messages', 'Please send a shorter conversation ending with your message.', 400);
  }
  return safe;
}

function configuredEndpoint(env) {
  const url = new URL(env.IZAKHONO_LOCAL_MODEL_URL || DEFAULT_MODEL_URL);
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const trustedHosts = String(env.IZAKHONO_MODEL_TRUSTED_HOSTS || '')
    .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
  if (url.username || url.password || url.search || url.hash) {
    throw new OneAIChatError('model_endpoint_invalid', 'ONE AI model endpoint configuration is invalid.');
  }
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    throw new OneAIChatError('model_endpoint_untrusted', 'ONE AI is restricted to loopback or approved HTTPS model endpoints.');
  }
  if (!loopback && !trustedHosts.includes(url.hostname.toLowerCase())) {
    throw new OneAIChatError('model_endpoint_untrusted', 'ONE AI model endpoint is not on the approved host list.');
  }
  if (!url.pathname.endsWith('/api/chat')) {
    throw new OneAIChatError('model_endpoint_invalid', 'ONE AI requires an Ollama-compatible chat endpoint.');
  }
  return { url, model: env.IZAKHONO_LOCAL_MODEL || DEFAULT_MODEL, secret: env.IZAKHONO_LOCAL_MODEL_SECRET || '' };
}

function headers(secret) {
  return {
    'content-type': 'application/json',
    ...(secret ? { authorization: 'Bearer ' + secret } : {})
  };
}

export function createOneAIChat({ env = process.env, fetcher = fetch } = {}) {
  async function health() {
    try {
      const config = configuredEndpoint(env);
      const healthUrl = new URL(config.url);
      healthUrl.pathname = healthUrl.pathname.replace(/\/api\/chat\/?$/, '/api/tags');
      const response = await fetcher(healthUrl, {
        method: 'GET',
        headers: headers(config.secret),
        signal: AbortSignal.timeout(4000)
      });
      if (!response.ok) return { ok: false, status: 'offline', model: config.model };
      const payload = await response.json();
      const models = Array.isArray(payload.models) ? payload.models : [];
      const installed = models.some((entry) =>
        entry && [entry.name, entry.model].some((name) =>
          typeof name === 'string' && (name === config.model || name.startsWith(config.model + ':'))
        )
      );
      return installed
        ? { ok: true, status: 'connected', model: config.model, provider: 'approved-local-runtime' }
        : { ok: false, status: 'model_missing', model: config.model };
    } catch {
      return { ok: false, status: 'offline', model: env.IZAKHONO_LOCAL_MODEL || DEFAULT_MODEL };
    }
  }

  async function chat(messages) {
    const safeMessages = validateChatMessages(messages);
    let config;
    try {
      config = configuredEndpoint(env);
    } catch (error) {
      if (error instanceof OneAIChatError) throw error;
      throw new OneAIChatError('model_endpoint_invalid', 'ONE AI model endpoint configuration is invalid.');
    }

    const system = {
      role: 'system',
      content: 'You are IZAKHONO ONE, a clear, capable and practical assistant for people, entrepreneurs and businesses, with an African-first and globally useful perspective. Be friendly, direct and easy to understand. Help users research, plan, write, analyse and organise work. Do not claim that you have sent messages, spent money, made purchases, changed accounts, published content, deployed software, deleted data or completed external actions. You may prepare plans and drafts. Before any consequential action, explain what would happen and request explicit approval. If a capability is unavailable, say so plainly. Never invent facts, progress, integrations or results.'
    };

    try {
      const response = await fetcher(config.url, {
        method: 'POST',
        headers: headers(config.secret),
        body: JSON.stringify({
          model: config.model,
          messages: [system, ...safeMessages],
          stream: false,
          options: { temperature: 0.3, num_predict: 1200 }
        }),
        signal: AbortSignal.timeout(60000)
      });
      if (!response.ok) {
        throw new OneAIChatError('one_ai_unavailable', 'ONE AI could not complete that response. Please try again shortly.');
      }
      const payload = await response.json();
      const message = payload && payload.message && payload.message.content;
      if (typeof message !== 'string' || !message.trim()) {
        throw new OneAIChatError('one_ai_empty_response', 'ONE AI returned an empty response. Please try again.');
      }
      return { ok: true, message: message.trim(), model: config.model, mode: 'approved-local-runtime' };
    } catch (error) {
      if (error instanceof OneAIChatError) throw error;
      throw new OneAIChatError('one_ai_unavailable', 'ONE AI is not connected right now. Your message has not been sent to another provider.');
    }
  }

  return { health, chat };
}
