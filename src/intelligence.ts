/**
 * IZAKHONO INTELLIGENCE — model registry and capability-aware router.
 *
 * This module is deliberately transport-neutral at the registry boundary.
 * OpenAI-compatible local/owner endpoints (LM Studio, Ollama compatibility
 * mode, llama.cpp server, vLLM) can be registered without binding product
 * code to a particular inference vendor.
 *
 * Secrets are supplied by the runtime from IZAKHONO VAULT references. Never
 * persist or log plaintext API keys in model records or job events.
 */

export type ModelTask = 'chat' | 'code' | 'reasoning' | 'vision' | 'audio' | 'embedding';
export type ModelTrust = 'local' | 'owner' | 'approved_external';

export interface ModelEndpoint {
  id: string;
  provider: string;
  model: string;
  baseUrl: string;
  trust: ModelTrust;
  capabilities: ModelTask[];
  contextWindow: number;
  enabled: boolean;
  healthy: boolean;
  maxOutputTokens?: number;
  estimatedCostPer1kTokens?: number;
  latencyMs?: number;
  secretRef?: string;
}

export interface ModelPolicy {
  allowedTrust: ModelTrust[];
  requiredCapabilities: ModelTask[];
  maxEstimatedCostPer1kTokens?: number;
  minContextWindow?: number;
  preferLocal?: boolean;
}

export interface ModelRequest {
  task: ModelTask;
  estimatedInputTokens?: number;
  maxOutputTokens?: number;
  policy: ModelPolicy;
}

export interface ModelSelection {
  endpoint: ModelEndpoint;
  reason: string;
}

export interface ModelRegistry {
  list(): Promise<ModelEndpoint[]>;
  getSecret(secretRef: string): Promise<string | undefined>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InferenceRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface InferenceResult {
  endpointId: string;
  model: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function normaliseBaseUrl(value: string): string {
  const url = new URL(value);
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(localHost && url.protocol === 'http:')) {
    throw new Error('Model endpoint must use HTTPS unless it is a loopback address.');
  }
  if (url.username || url.password) throw new Error('Credentials must not be embedded in model endpoint URLs.');
  return url.toString().replace(/\/$/, '');
}

function supports(endpoint: ModelEndpoint, required: ModelTask[]): boolean {
  return required.every((capability) => endpoint.capabilities.includes(capability));
}

/** Select the least-cost eligible endpoint, with local/owner preference as a tie-breaker. */
export function selectModel(endpoints: ModelEndpoint[], request: ModelRequest): ModelSelection {
  const required = [...new Set([request.task, ...request.policy.requiredCapabilities])];
  const candidates = endpoints.filter((endpoint) =>
    endpoint.enabled &&
    endpoint.healthy &&
    request.policy.allowedTrust.includes(endpoint.trust) &&
    supports(endpoint, required) &&
    endpoint.contextWindow >= Math.max(request.estimatedInputTokens ?? 0, request.policy.minContextWindow ?? 0) &&
    (request.policy.maxEstimatedCostPer1kTokens === undefined ||
      (endpoint.estimatedCostPer1kTokens ?? 0) <= request.policy.maxEstimatedCostPer1kTokens),
  );

  if (!candidates.length) throw new Error('No healthy model endpoint satisfies the requested task and policy.');

  candidates.sort((a, b) => {
    const cost = (a.estimatedCostPer1kTokens ?? 0) - (b.estimatedCostPer1kTokens ?? 0);
    if (cost !== 0) return cost;
    if (request.policy.preferLocal) {
      const rank = (trust: ModelTrust) => trust === 'local' ? 0 : trust === 'owner' ? 1 : 2;
      const trustRank = rank(a.trust) - rank(b.trust);
      if (trustRank !== 0) return trustRank;
    }
    return (a.latencyMs ?? Number.MAX_SAFE_INTEGER) - (b.latencyMs ?? Number.MAX_SAFE_INTEGER);
  });

  const endpoint = candidates[0];
  return {
    endpoint,
    reason: `Selected ${endpoint.provider}/${endpoint.model}: healthy, policy-eligible, supports ${required.join(', ')}.`,
  };
}

/** OpenAI-compatible chat-completions adapter for local and owner-hosted inference servers. */
export async function runChatCompletion(
  endpoint: ModelEndpoint,
  request: InferenceRequest,
  registry: ModelRegistry,
  fetcher: FetchLike = fetch,
  timeoutMs = 60_000,
): Promise<InferenceResult> {
  const baseUrl = normaliseBaseUrl(endpoint.baseUrl);
  const secret = endpoint.secretRef ? await registry.getSecret(endpoint.secretRef) : undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetcher(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({
        model: request.model || endpoint.model,
        messages: request.messages,
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        ...(request.max_tokens === undefined ? {} : { max_tokens: request.max_tokens }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Do not include response bodies: providers may echo sensitive request data.
      throw new Error(`Inference endpoint returned HTTP ${response.status}.`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const raw = payload.choices?.[0]?.message?.content;
    const content = typeof raw === 'string'
      ? raw
      : Array.isArray(raw)
        ? raw.filter((part) => part.type === 'text' && typeof part.text === 'string').map((part) => part.text).join('\n')
        : '';

    if (!content.trim()) throw new Error('Inference endpoint returned no assistant text.');

    return {
      endpointId: endpoint.id,
      model: request.model || endpoint.model,
      content,
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Safe registration validation. Call before persisting endpoint metadata. */
export function validateModelEndpoint(endpoint: ModelEndpoint): ModelEndpoint {
  if (!endpoint.id.trim() || !endpoint.provider.trim() || !endpoint.model.trim()) {
    throw new Error('Model endpoint id, provider and model are required.');
  }
  if (!Number.isInteger(endpoint.contextWindow) || endpoint.contextWindow < 1) {
    throw new Error('Model contextWindow must be a positive integer.');
  }
  if (!endpoint.capabilities.length) throw new Error('At least one model capability is required.');
  return { ...endpoint, baseUrl: normaliseBaseUrl(endpoint.baseUrl), capabilities: [...new Set(endpoint.capabilities)] };
}
