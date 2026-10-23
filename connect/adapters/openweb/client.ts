import { OPENWEB_API } from "./adapter";

export const OPENWEB_TOKEN_ENV = "OPENWEB_API_TOKEN" as const;
export const OPENWEB_RATE_LIMIT_PER_MINUTE = 100 as const;

export type OpenWebClientConfig = {
  token: string;
  fetchImpl?: typeof fetch;
};

export type OpenWebError = {
  status: number;
  code: string;
  message: string;
  requestId?: string;
};

export type OpenWebResult<T> =
  | { ok: true; data: T; requestId?: string }
  | { ok: false; error: OpenWebError };

function normalizeError(status: number, body: unknown, requestId?: string): OpenWebError {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const code = typeof record.code === "string" ? record.code : `HTTP_${status}`;
  const message = typeof record.message === "string"
    ? record.message
    : typeof record.error === "string"
      ? record.error
      : "OpenWeb request failed";
  return { status, code, message, requestId };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function createOpenWebClient(config: OpenWebClientConfig) {
  if (!config.token || !config.token.trim()) {
    throw new Error(`${OPENWEB_TOKEN_ENV} is required on the server runtime`);
  }

  const fetchImpl = config.fetchImpl ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<OpenWebResult<T>> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${config.token}`);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

    const response = await fetchImpl(`${OPENWEB_API.baseUrl}${path}`, { ...init, headers });
    const requestId = response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined;
    const body = await readBody(response);

    if (!response.ok) {
      return { ok: false, error: normalizeError(response.status, body, requestId) };
    }

    return { ok: true, data: body as T, requestId };
  }

  return {
    request,
    products: <T = unknown>() => request<T>(OPENWEB_API.products),
    coverage: <T = unknown>(body: unknown) => request<T>(OPENWEB_API.fibreCoverage, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    createOrder: <T = unknown>(body: unknown) => request<T>(OPENWEB_API.createOrder, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    services: <T = unknown>() => request<T>(OPENWEB_API.services),
    service: <T = unknown>(serviceId: number) => request<T>(OPENWEB_API.service(serviceId)),
    cancelService: <T = unknown>(serviceId: number, body?: unknown) => request<T>(OPENWEB_API.cancelService(serviceId), {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    wallet: <T = unknown>() => request<T>(OPENWEB_API.wallet),
    invoices: <T = unknown>() => request<T>(OPENWEB_API.invoices),
    endusers: <T = unknown>() => request<T>(OPENWEB_API.endusers),
  };
}
