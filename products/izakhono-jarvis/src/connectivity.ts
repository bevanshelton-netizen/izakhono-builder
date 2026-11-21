/**
 * J.A.R.V.I.S. connectivity and capability policy.
 *
 * This module is deliberately side-effect free: callers supply independently
 * observed browser/network, authenticated API, and local-model health. It does
 * not infer API availability from navigator.onLine and never authorises
 * consequential external actions.
 */
export type JarvisConnectivityMode = "starting" | "online" | "degraded" | "offline" | "syncing";
export type ApiHealth = "healthy" | "unreachable" | "unauthorized" | "unknown";
export type JarvisAction =
  | "local_read"
  | "local_draft"
  | "local_inference"
  | "remote_read"
  | "remote_write"
  | "cloud_connector"
  | "remote_workforce"
  | "consequential_external";

export interface ConnectivityObservation {
  browserOnline: boolean;
  api: ApiHealth;
  localModelHealthy: boolean;
  syncRequested?: boolean;
}

export interface JarvisCapabilities {
  localRead: boolean;
  localDrafts: boolean;
  localInference: boolean;
  remoteRead: boolean;
  remoteWrite: boolean;
  cloudConnectors: boolean;
  remoteWorkforce: boolean;
  sync: boolean;
  consequentialExternalActions: false;
}

export interface JarvisRuntimeStatus {
  mode: JarvisConnectivityMode;
  api: ApiHealth;
  localModel: "available" | "unavailable";
  capabilities: JarvisCapabilities;
  reason: string;
}

export function deriveJarvisRuntimeStatus(
  observation: ConnectivityObservation,
): JarvisRuntimeStatus {
  let mode: JarvisConnectivityMode;
  let reason: string;

  if (!observation.browserOnline) {
    mode = "offline";
    reason = "The device reports no network connection.";
  } else if (observation.api === "healthy") {
    mode = observation.syncRequested ? "syncing" : "online";
    reason = observation.syncRequested
      ? "The authenticated API is healthy; synchronisation is in progress."
      : "The authenticated API is healthy.";
  } else if (observation.api === "unknown") {
    mode = "starting";
    reason = "Authenticated API health has not yet been established.";
  } else {
    mode = "degraded";
    reason = observation.api === "unauthorized"
      ? "The API is reachable but owner authentication is not valid."
      : "The network is present but the authenticated API is unavailable.";
  }

  const remoteReady = mode === "online" || mode === "syncing";
  const capabilities: JarvisCapabilities = {
    localRead: true,
    localDrafts: true,
    localInference: observation.localModelHealthy,
    remoteRead: remoteReady,
    remoteWrite: remoteReady,
    cloudConnectors: remoteReady,
    remoteWorkforce: remoteReady,
    sync: remoteReady && observation.syncRequested === true,
    // This policy layer can never grant permission for consequential actions.
    // Those require a separate owner approval and server-side revalidation.
    consequentialExternalActions: false,
  };

  return {
    mode,
    api: observation.api,
    localModel: observation.localModelHealthy ? "available" : "unavailable",
    capabilities,
    reason,
  };
}

/**
 * Evaluate a requested operation against the latest derived status.
 * Owner authentication is required for every operation; consequential actions
 * remain denied here even when online and authenticated.
 */
export function isJarvisActionAllowed(
  status: JarvisRuntimeStatus,
  action: JarvisAction,
  ownerAuthenticated: boolean,
): boolean {
  if (!ownerAuthenticated) return false;
  switch (action) {
    case "local_read": return status.capabilities.localRead;
    case "local_draft": return status.capabilities.localDrafts;
    case "local_inference": return status.capabilities.localInference;
    case "remote_read": return status.capabilities.remoteRead;
    case "remote_write": return status.capabilities.remoteWrite;
    case "cloud_connector": return status.capabilities.cloudConnectors;
    case "remote_workforce": return status.capabilities.remoteWorkforce;
    case "consequential_external": return false;
    default: return false;
  }
}
