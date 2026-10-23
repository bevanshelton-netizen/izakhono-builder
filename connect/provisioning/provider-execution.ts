import { transition, type ProvisioningState } from "./state-machine";
import type {
  CoverageRequest,
  CreateOrderRequest,
  OrderStatusRequest,
  ProviderAdapter,
  ProviderOperationResult,
} from "../adapters/openweb/types";

export type ProviderExecutionInput = {
  adapter: ProviderAdapter;
  state: ProvisioningState;
  coverage: CoverageRequest;
  order: CreateOrderRequest;
};

export type ProviderExecutionResult = {
  state: ProvisioningState;
  coverage?: ProviderOperationResult;
  order?: ProviderOperationResult;
  service?: ProviderOperationResult;
};

function errorMessage(result: ProviderOperationResult): string {
  return result.ok ? "" : `${result.code}: ${result.message}`;
}

function serviceIsActive(result: ProviderOperationResult): boolean {
  if (!result.ok) return false;
  const value = result.data as unknown;
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const candidates = [record.status, record.service_status, record.serviceStatus, record.state];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && ["active", "activated", "live", "running"].includes(candidate.toLowerCase())) return true;
  }
  for (const key of ["data", "service", "result"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const nestedRecord = nested as Record<string, unknown>;
      const status = nestedRecord.status ?? nestedRecord.service_status ?? nestedRecord.serviceStatus ?? nestedRecord.state;
      if (typeof status === "string" && ["active", "activated", "live", "running"].includes(status.toLowerCase())) return true;
    }
  }
  return false;
}

function providerReference(result: ProviderOperationResult): string | undefined {
  if (!result.ok || !result.data || typeof result.data !== "object") return undefined;
  const record = result.data as Record<string, unknown>;
  const reference = record.providerReference;
  return typeof reference === "string" && reference.trim() ? reference : undefined;
}

export async function executeProviderProvisioning(input: ProviderExecutionInput): Promise<ProviderExecutionResult> {
  let state = input.state;
  state = transition(state, "COVERAGE_REQUESTED");

  const coverage = await input.adapter.coverage(input.coverage);
  if (!coverage.ok) {
    state = transition(state, "COVERAGE_UNAVAILABLE", { blocker: errorMessage(coverage) });
    return { state, coverage };
  }

  state = transition(state, "COVERAGE_CONFIRMED");
  const order = await input.adapter.createOrder(input.order);
  if (!order.ok) {
    state = transition(state, "ORDER_SUBMITTED");
    state = transition(state, "PROVIDER_ERROR", { blocker: errorMessage(order) });
    return { state, coverage, order };
  }

  const reference = providerReference(order);
  if (!reference) {
    state = transition(state, "ORDER_SUBMITTED");
    state = transition(state, "PROVIDER_ERROR", { blocker: "Provider accepted the order without a service reference." });
    return { state, coverage, order };
  }

  state = transition(state, "ORDER_SUBMITTED", { providerReference: reference });
  state = transition(state, "ORDER_ACCEPTED", { providerReference: reference });

  const service: ProviderOperationResult = await input.adapter.orderStatus({ providerReference: reference } satisfies OrderStatusRequest);
  if (!service.ok || !serviceIsActive(service)) {
    state = transition(state, "PROVIDER_ERROR", { providerReference: reference, blocker: service.ok ? "Provider service is not active yet." : errorMessage(service) });
    return { state, coverage, order, service };
  }

  state = transition(state, "SERVICE_ACTIVE", { providerReference: reference });
  return { state, coverage, order, service };
}
