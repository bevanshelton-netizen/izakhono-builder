import { openWebAdapter } from "./adapter";
import type { ConnectCapability, ProviderAdapter } from "./types";

const registry = new Map<string, ProviderAdapter>([
  [openWebAdapter.provider, openWebAdapter],
]);

export function getProviderAdapter(provider: string): ProviderAdapter | undefined {
  return registry.get(provider.toUpperCase());
}

export function hasProviderCapability(
  provider: string,
  capability: ConnectCapability,
): boolean {
  const adapter = getProviderAdapter(provider);
  return Boolean(adapter?.capabilities.includes(capability));
}

export { openWebAdapter };
export type {
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
