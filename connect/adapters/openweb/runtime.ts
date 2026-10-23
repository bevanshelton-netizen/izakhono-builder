import { OPENWEB_TOKEN_ENV, createOpenWebClient } from "./client";
import { OPENWEB_API } from "./adapter";
import type {
  CancelOrderRequest,
  CoverageRequest,
  CreateOrderRequest,
  OrderStatusRequest,
  ProviderAdapter,
  ProviderOperationResult,
  QuoteRequest,
} from "./types";

const PROVIDER = "OPENWEB";

const notConfigured = <T>(capability: Parameters<ProviderAdapter["coverage"]>[0] extends never ? never : any): ProviderOperationResult<T> => ({
  ok: false,
  provider: PROVIDER,
  capability,
  code: "NOT_CONFIGURED",
  message: `OpenWeb is not activated: ${OPENWEB_TOKEN_ENV} is missing from the server runtime.`,
});

function providerError<T>(capability: any, message: string): ProviderOperationResult<T> {
  return { ok: false, provider: PROVIDER, capability, code: "PROVIDER_ERROR", message };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function findReference(value: unknown): string | undefined {
  const record = asRecord(value);
  const candidates = [record.service_id, record.serviceId, record.order_id, record.orderId, record.id, record.reference, record.external_reference, record.externalReference];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  }
  for (const key of ["data", "service", "order", "result"]) {
    if (record[key]) {
      const nested = findReference(record[key]);
      if (nested) return nested;
    }
  }
  return undefined;
}

function serviceId(reference: string): number | undefined {
  const value = Number(reference);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

/**
 * Credential-gated runtime implementation. The token is read only by the
 * server runtime; callers never receive the token or an authenticated client.
 */
export function createOpenWebRuntimeAdapter(env: Record<string, string | undefined> = process.env): ProviderAdapter {
  const token = env[OPENWEB_TOKEN_ENV];
  if (!token?.trim()) {
    return {
      provider: PROVIDER,
      mode: "api",
      status: "planned",
      capabilities: ["coverage", "quote", "create_order", "order_status", "cancel_order"],
      coverage: async () => notConfigured("coverage"),
      quote: async () => notConfigured("quote"),
      createOrder: async () => notConfigured("create_order"),
      orderStatus: async () => notConfigured("order_status"),
      cancelOrder: async () => notConfigured("cancel_order"),
    };
  }

  const client = createOpenWebClient({ token });

  return {
    provider: PROVIDER,
    mode: "api",
    status: "active",
    capabilities: ["coverage", "quote", "create_order", "order_status", "cancel_order"],

    async coverage(request: CoverageRequest) {
      const result = await client.coverage({
        address: request.address,
        ...(request.productCode ? { product_code: request.productCode } : {}),
        ...(request.latitude !== undefined ? { latitude: request.latitude } : {}),
        ...(request.longitude !== undefined ? { longitude: request.longitude } : {}),
      });
      if (!result.ok) return providerError("coverage", result.error.message);
      return { ok: true, provider: PROVIDER, capability: "coverage", data: result.data };
    },

    async quote(request: QuoteRequest) {
      const result = await client.products();
      if (!result.ok) return providerError("quote", result.error.message);
      return { ok: true, provider: PROVIDER, capability: "quote", data: result.data };
    },

    async createOrder(request: CreateOrderRequest) {
      const body: Record<string, unknown> = {
        product_code: request.productCode,
        customer: request.customer,
        ...(request.serviceAddress ? { service_address: request.serviceAddress } : {}),
        ...(request.externalReference ? { external_reference: request.externalReference } : {}),
        ...(request.providerProductId !== undefined ? { product_id: request.providerProductId } : {}),
        ...(request.quantity !== undefined ? { quantity: request.quantity } : {}),
        ...(request.simCardId !== undefined ? { sim_card_id: request.simCardId } : {}),
        ...(request.fibreCoverageToken ? { fibre_coverage_token: request.fibreCoverageToken } : {}),
      };
      const result = await client.createOrder(body);
      if (!result.ok) return providerError("create_order", result.error.message);
      const reference = findReference(result.data);
      return {
        ok: true,
        provider: PROVIDER,
        capability: "create_order",
        data: { response: result.data, providerReference: reference },
      };
    },

    async orderStatus(request: OrderStatusRequest) {
      const id = serviceId(request.providerReference);
      if (id === undefined) return providerError("order_status", "OpenWeb service reference must be a numeric service ID.");
      const result = await client.service(id);
      if (!result.ok) return providerError("order_status", result.error.message);
      return { ok: true, provider: PROVIDER, capability: "order_status", data: result.data };
    },

    async cancelOrder(request: CancelOrderRequest) {
      const id = serviceId(request.providerReference);
      if (id === undefined) return providerError("cancel_order", "OpenWeb service reference must be a numeric service ID.");
      const result = await client.cancelService(id, request.reason ? { reason: request.reason } : undefined);
      if (!result.ok) return providerError("cancel_order", result.error.message);
      return { ok: true, provider: PROVIDER, capability: "cancel_order", data: result.data };
    },
  };
}

export const OPENWEB_RUNTIME_BASE_URL = OPENWEB_API.baseUrl;
