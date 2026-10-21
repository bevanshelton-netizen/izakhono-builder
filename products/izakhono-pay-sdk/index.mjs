const DEFAULT_BASE_URL = "https://api.izakhono.africa";

function required(value, name) {
  if (value === undefined || value === null || value === "") throw new TypeError(`${name} is required`);
  return value;
}

function jsonHeaders(apiKey, idempotencyKey) {
  return {
    "content-type": "application/json",
    "accept": "application/json",
    authorization: `Bearer ${required(apiKey, "apiKey")}`,
    ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {})
  };
}

export class IzakhonoPayError extends Error {
  constructor(message, { status = 0, code = "unknown_error", requestId = null, details = null } = {}) {
    super(message);
    this.name = "IzakhonoPayError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

export class IzakhonoPay {
  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, fetchImpl = globalThis.fetch } = {}) {
    this.apiKey = required(apiKey, "apiKey");
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
    this.fetch = fetchImpl;
  }

  async request(path, { method = "GET", body, idempotencyKey, signal } = {}) {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: jsonHeaders(this.apiKey, idempotencyKey),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
    if (!response.ok) {
      throw new IzakhonoPayError(payload?.error?.message || payload?.message || `IZAKHONO PAY request failed (${response.status})`, {
        status: response.status,
        code: payload?.error?.code || payload?.code || "http_error",
        requestId: response.headers.get("x-request-id"),
        details: payload
      });
    }
    return payload;
  }

  health(options) { return this.request("/v1/health", options); }
  createPaymentIntent(input, { idempotencyKey, signal } = {}) {
    required(input?.amount, "amount");
    required(input?.currency, "currency");
    return this.request("/v1/payment-intents", { method: "POST", body: input, idempotencyKey, signal });
  }
  getPaymentIntent(id, options = {}) {
    return this.request(`/v1/payment-intents/${encodeURIComponent(required(id, "id"))}`, options);
  }
  cancelPaymentIntent(id, options = {}) {
    return this.request(`/v1/payment-intents/${encodeURIComponent(required(id, "id"))}/cancel`, { method: "POST", ...options });
  }
  createRefund(paymentIntentId, input = {}, { idempotencyKey, signal } = {}) {
    return this.request(`/v1/payment-intents/${encodeURIComponent(required(paymentIntentId, "paymentIntentId"))}/refunds`, { method: "POST", body: input, idempotencyKey, signal });
  }
  listTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/v1/transactions${query ? `?${query}` : ""}`);
  }
}

export function createSandboxClient(options = {}) {
  return new IzakhonoPay({ ...options, baseUrl: options.baseUrl || "http://localhost:8787" });
}
