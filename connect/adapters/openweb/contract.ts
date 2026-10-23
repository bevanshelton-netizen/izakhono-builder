export const OPENWEB_CONTRACT = {
  baseUrl: "https://reseller.openweb.co.za",
  auth: {
    tokenEndpoint: "/api/v1/auth/token",
    revokeEndpoint: "/api/v1/auth/revoke",
  },
  catalogue: {
    products: "/api/v1/products",
    simInventory: "/api/v1/sim-inventory",
  },
  coverage: {
    fibre: "/api/v1/fibre/coverage",
  },
  orders: {
    create: "/api/v1/orders",
    assignProduct: "/api/v1/endusers/assign-product",
  },
  services: {
    list: "/api/v1/services",
    detail: (serviceId: number) => `/api/v1/services/${serviceId}`,
    cancel: (serviceId: number) => `/api/v1/services/${serviceId}/cancel`,
    reactivate: (serviceId: number) => `/api/v1/services/${serviceId}/reactivate`,
  },
  account: {
    me: "/api/v1/me",
    wallet: "/api/v1/wallet",
    invoices: "/api/v1/invoices",
    transactions: "/api/v1/transactions",
    endusers: "/api/v1/endusers",
  },
  system: {
    health: "/api/v1/health",
  },
  rateLimit: {
    requestsPerMinutePerToken: 100,
  },
} as const;

export type OpenWebContract = typeof OPENWEB_CONTRACT;
