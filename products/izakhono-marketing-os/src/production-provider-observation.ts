import type { RecoveryRecord } from "./execution-recovery";
import { ProviderObservationRegistry } from "./provider-observation";
import {
  createOwnedNodeObservationAdapter,
  HttpOwnedNodeObservationClient,
} from "./owned-node-observation";
import {
  createMetricoolObservationAdapter,
  HttpMetricoolObservationClient,
} from "./metricool-observation";

export interface ProductionProviderObservationEnvironment {
  IZAKHONO_OWNED_NODE_OBSERVATION_ENDPOINT?: string;
  IZAKHONO_OWNED_NODE_OBSERVATION_TOKEN?: string;
  METRICOOL_OBSERVATION_ENDPOINT?: string;
  METRICOOL_OBSERVATION_TOKEN?: string;
}

function required(env: ProductionProviderObservationEnvironment, key: keyof ProductionProviderObservationEnvironment): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required for production provider observation`);
  return value;
}

export function createProductionProviderObservationRegistry(
  env: ProductionProviderObservationEnvironment = process.env,
  fetchImpl: typeof fetch = fetch,
): ProviderObservationRegistry {
  const ownedEndpoint = required(env, "IZAKHONO_OWNED_NODE_OBSERVATION_ENDPOINT");
  const ownedToken = required(env, "IZAKHONO_OWNED_NODE_OBSERVATION_TOKEN");
  const metricoolEndpoint = required(env, "METRICOOL_OBSERVATION_ENDPOINT");
  const metricoolToken = required(env, "METRICOOL_OBSERVATION_TOKEN");

  const registry = new ProviderObservationRegistry();
  registry.register(createOwnedNodeObservationAdapter(new HttpOwnedNodeObservationClient({
    endpoint: ownedEndpoint,
    token: ownedToken,
    fetchImpl,
  })));
  registry.register(createMetricoolObservationAdapter(new HttpMetricoolObservationClient({
    endpoint: metricoolEndpoint,
    token: metricoolToken,
    fetchImpl,
  })));
  return registry;
}

export function assertProductionProviderObservationConfiguration(
  env: ProductionProviderObservationEnvironment = process.env,
): void {
  required(env, "IZAKHONO_OWNED_NODE_OBSERVATION_ENDPOINT");
  required(env, "IZAKHONO_OWNED_NODE_OBSERVATION_TOKEN");
  required(env, "METRICOOL_OBSERVATION_ENDPOINT");
  required(env, "METRICOOL_OBSERVATION_TOKEN");
}

export type ProductionProviderObservationAdapterKind = RecoveryRecord["receipt"]["adapter"];
