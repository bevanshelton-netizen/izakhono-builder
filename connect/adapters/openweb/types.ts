export type ConnectCapability =
  | "coverage"
  | "quote"
  | "create_order"
  | "order_status"
  | "cancel_order";

export type AdapterMode = "manual" | "api" | "hybrid";

export type AdapterStatus = "planned" | "ready" | "active" | "disabled";

export type ProviderOperationResult<T = unknown> =
  | { ok: true; data: T; provider: string; capability: ConnectCapability }
  | {
      ok: false;
      provider: string;
      capability: ConnectCapability;
      code: "NOT_CONFIGURED" | "UNSUPPORTED" | "PROVIDER_ERROR";
      message: string;
    };

export interface CoverageRequest {
  address: string;
  productCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface QuoteRequest {
  productCode: string;
  address?: string;
}

export interface CreateOrderRequest {
  productCode: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  serviceAddress?: string;
  externalReference?: string;
  providerProductId?: number;
  quantity?: number;
  simCardId?: number;
  fibreCoverageToken?: string;
}

export interface OrderStatusRequest {
  providerReference: string;
}

export interface CancelOrderRequest {
  providerReference: string;
  reason?: string;
}

export interface ProviderAdapter {
  readonly provider: string;
  readonly mode: AdapterMode;
  readonly status: AdapterStatus;
  readonly capabilities: readonly ConnectCapability[];

  coverage(request: CoverageRequest): Promise<ProviderOperationResult>;
  quote(request: QuoteRequest): Promise<ProviderOperationResult>;
  createOrder(request: CreateOrderRequest): Promise<ProviderOperationResult>;
  orderStatus(request: OrderStatusRequest): Promise<ProviderOperationResult>;
  cancelOrder(request: CancelOrderRequest): Promise<ProviderOperationResult>;
}
