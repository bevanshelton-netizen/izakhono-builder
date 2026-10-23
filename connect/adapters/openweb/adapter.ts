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
const API_BASE = "https://reseller.openweb.co.za";

/** Verified against the current public OpenWeb Reseller OpenAPI contract.
 * Credentials remain server-side and are intentionally not represented here.
 */
export const OPENWEB_API = {
  baseUrl: API_BASE,
  health: "/api/v1/health",
  products: "/api/v1/products",
  fibreCoverage: "/api/v1/fibre/coverage",
  createOrder: "/api/v1/orders",
  assignProduct: "/api/v1/endusers/assign-product",
  services: "/api/v1/services",
  service: (serviceId: number) => `/api/v1/services/${serviceId}`,
  cancelService: (serviceId: number) => `/api/v1/services/${serviceId}/cancel`,
  wallet: "/api/v1/wallet",
  invoices: "/api/v1/invoices",
  endusers: "/api/v1/endusers",
} as const;

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
    "OpenWeb API contract is verified, but IZAKHONO server-side credentials are not configured. No customer service is activated by this adapter.",
});

/**
 * IZAKHONO-owned OpenWeb boundary.
 *
 * The public OpenWeb contract is known, but execution remains credential-gated.
 * This prevents credentials from entering browser code and prevents an
 * unapproved reseller account from being treated as production connectivity.
 */
export const openWebAdapter: ProviderAdapter = {
  provider: PROVIDER,
  mode: "api" as AdapterMode,
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
