/**
 * IZAKHONO INTELLIGENCE — provider-neutral, local-only Ollama router.
 *
 * Model records are adapters, not authorities. All inference is constrained to
 * loopback or private IZAKHONO-owned endpoints using the Ollama /api/chat API.
 * Legacy approved_external records are rejected and never used for fallback.
 */

export type ModelTask = 'chat' | 'code' | 'reasoning' | 'vision' | 'audio' | 'embedding';
export type ModelTrust = 'local' | 'owner' | 'approved_external';
export type ModelProtocol = 'ollama-chat';

export interface ModelEndpoint {
  id: string;
  provider: string;
  protocol?: ModelProtocol;
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

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  const octets = host.split('.');
  if (octets.length === 4 && octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) {
    const [a, b] = octets.map(Number);
    return a === 10 || a === 127 || (a === 192 && b === 168)
      || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)
      || (a === 100 && b >= 64 && b <= 127);
  }
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd')) return true;
  return /^fe[89ab][0-9a-f]:/i.test(host);
}

function normaliseBaseUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Model endpoint must use HTTP(S) on a private IZAKHONO network.');
  if (url.username || url.password) throw new Error('Credentials must not be embedded in model endpoint URLs.');
  if (url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('Ollama base URL must be an origin without a path, query or fragment.');
  if (!isPrivateHost(url.hostname)) throw new Error('Model endpoint must resolve to loopback or a private IZAKHONO address.');
  return url.origin;
}

function supports(endpoint: ModelEndpoint, required: ModelTask[]): boolean {
  return required.every((capability) => endpoint.capabilities.includes(capability));
}

/** Only local or owner-controlled private endpoints can enter the candidate list. */
export function rankModels(endpoints: ModelEndpoint[], request: ModelRequest): ModelEndpoint[] {
  const required = [...new Set([request.task, ...request.policy.requiredCapabilities])];
  const candidates = endpoints.filter((endpoint) => {
    if (endpoint.trust === 'approved_external' || !['local', 'owner'].includes(endpoint.trust)) return false;
    if (!request.policy.allowedTrust.includes(endpoint.trust)) return false;
    if (endpoint.protocol && endpoint.protocol !== 'ollama-chat') return false;
    try { normaliseBaseUrl(endpoint.baseUrl); } catch { return false; }
    return endpoint.enabled &&
      endpoint.healthy &&
      supports(endpoint, required) &&
      endpoint.contextWindow >= Math.max(request.estimatedInputTokens ?? 0, request.policy.minContextWindow ?? 0) &&
      (request.policy.maxEstimatedCostPer1kTokens === undefined ||
        (endpoint.estimatedCostPer1kTokens ?? 0) <= request.policy.maxEstimatedCostPer1kTokens);
  });

  candidates.sort((a, b) => {
    if (request.policy.preferLocal) {
      const rank = (trust: ModelTrust) => trust === 'local' ? 0 : trust === 'owner' ? 1 : 2;
      const trustRank = rank(a.trust) - rank(b.trust);
      if (trustRank !== 0) return trustRank;
    }
    const cost = (a.estimatedCostPer1kTokens ?? 0) - (b.estimatedCostPer1kTokens ?? 0);
    if (cost !== 0) return cost;
    return (a.latencyMs ?? Number.MAX_SAFE_INTEGER) - (b.latencyMs ?? Number.MAX_SAFE_INTEGER);
  });
  return candidates;
}

export function selectModel(endpoints: ModelEndpoint[], request: ModelRequest): ModelSelection {
  const required = [...new Set([request.task, ...request.policy.requiredCapabilities])];
  const endpoint = rankModels(endpoints, request)[0];
  if (!endpoint) throw new Error('No healthy private Ollama endpoint satisfies the requested task and policy.');
  return {
    endpoint,
    reason: `Selected owned local runtime ${endpoint.provider}/${endpoint.model}; private Ollama endpoint satisfies ${required.join(', ')}.`,
  };
}

/** Execute one Ollama-compatible /api/chat request. */
export async function runOllamaChat(
  endpoint: ModelEndpoint,
  request: InferenceRequest,
  fetcher: FetchLike = fetch,
  timeoutMs = 60_000,
): Promise<InferenceResult> {
  const baseUrl = normaliseBaseUrl(endpoint.baseUrl);
  if (endpoint.trust === 'approved_external') throw new Error('External inference is disabled by IZAKHONO policy.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetcher(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: request.model || endpoint.model,
        messages: request.messages,
        stream: false,
        ...((request.temperature === undefined && request.max_tokens === undefined) ? {} : {
          options: {
            ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
            ...(request.max_tokens === undefined ? {} : { num_predict: request.max_tokens }),
          },
        }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Ollama endpoint returned HTTP ${response.status}.`);
    const payload = await response.json() as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const content = payload.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('Ollama endpoint returned no assistant text.');

    return {
      endpointId: endpoint.id,
      model: request.model || endpoint.model,
      content,
      inputTokens: payload.prompt_eval_count,
      outputTokens: payload.eval_count,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export interface RoutedInferenceResult extends InferenceResult {
  attempts: number;
  fallbackUsed: boolean;
}

/** Fallback may move between owned private Ollama runtimes only; it never widens trust. */
export async function runWithModelFallback(
  endpoints: ModelEndpoint[],
  request: ModelRequest & InferenceRequest,
  registry: ModelRegistry,
  fetcher: FetchLike = fetch,
): Promise<RoutedInferenceResult> {
  void registry;
  const candidates = rankModels(endpoints, request);
  if (!candidates.length) throw new Error('No healthy private Ollama endpoint satisfies the requested task and policy.');
  const failures: string[] = [];

  for (const [index, endpoint] of candidates.entries()) {
    try {
      const result = await runOllamaChat(endpoint, request, fetcher);
      return { ...result, attempts: index + 1, fallbackUsed: index > 0 };
    } catch (error) {
      failures.push(`${endpoint.id}: ${String(error instanceof Error ? error.message : 'inference failed').slice(0, 120)}`);
    }
  }
  throw new Error(`All eligible private Ollama endpoints failed (${failures.join('; ')}).`);
}

/** Validate endpoint metadata before it is persisted in the model registry. */
export function validateModelEndpoint(endpoint: ModelEndpoint): ModelEndpoint {
  if (!endpoint.id.trim() || !endpoint.provider.trim() || !endpoint.model.trim()) {
    throw new Error('Model endpoint id, provider and model are required.');
  }
  if (endpoint.trust === 'approved_external') throw new Error('External inference endpoints are disabled by IZAKHONO policy.');
  if (endpoint.protocol && endpoint.protocol !== 'ollama-chat') throw new Error('Only the Ollama-compatible chat protocol is supported.');
  if (!Number.isInteger(endpoint.contextWindow) || endpoint.contextWindow < 1) {
    throw new Error('Model contextWindow must be a positive integer.');
  }
  if (!endpoint.capabilities.length) throw new Error('At least one model capability is required.');
  if (endpoint.secretRef) throw new Error('The local Ollama runtime does not accept provider API-key references.');
  return { ...endpoint, protocol: 'ollama-chat', baseUrl: normaliseBaseUrl(endpoint.baseUrl), capabilities: [...new Set(endpoint.capabilities)] };
}
