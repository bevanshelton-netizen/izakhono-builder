import type {
  AdapterMode,
  AdapterStatus,
  CancelOrderRequest,
  ConnectCapability,
  CoverageRequest,
  CreateOrderRequest,
  OrderStatusRequest,
  ProviderAdapter,
  ProviderOperationResult,
  QuoteRequest,
} from "./types";

const PROVIDER = "OPENWEB";
const CAPABILITIES: readonly ConnectCapability[] = [
  "coverage",
  "quote",
  "create_order",
  "order_status",
  "cancel_order",
];

const notConfigured = <T>(
  capability: ConnectCapability,
): ProviderOperationResult<T> => ({
  ok: false,
  provider: PROVIDER,
  capability,
  code: "NOT_CONFIGURED",
  message:
    "OpenWeb credentials and the approved server-side API contract are not configured. No customer service is activated by this adapter.",
});

/**
 * OpenWeb remains deliberately server-side and contract-gated.
 *
 * This adapter defines the IZAKHONO-owned boundary without inventing
 * OpenWeb endpoints, credentials, or activation semantics. Once the
 * reseller/API contract is available, only this module needs to bind the
 * real provider operations.
 */
export const openWebAdapter: ProviderAdapter = {
  provider: PROVIDER,
  mode: "manual" as AdapterMode,
  status: "planned" as AdapterStatus,
  capabilities: CAPABILITIES,

  async coverage(_request: CoverageRequest) {
    return notConfigured("coverage");
  },

  async quote(_request: QuoteRequest) {
    return notConfigured("quote");
  },

  async createOrder(_request: CreateOrderRequest) {
    return notConfigured("create_order");
  },

  async orderStatus(_request: OrderStatusRequest) {
    return notConfigured("order_status");
  },

  async cancelOrder(_request: CancelOrderRequest) {
    return notConfigured("cancel_order");
  },
};
