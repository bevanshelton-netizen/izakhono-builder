import assert from "node:assert/strict";
import {
  deriveJarvisRuntimeStatus,
  isJarvisActionAllowed,
  type ConnectivityObservation,
} from "./connectivity";

const observe = (overrides: Partial<ConnectivityObservation> = {}) =>
  deriveJarvisRuntimeStatus({
    browserOnline: true,
    api: "healthy",
    localModelHealthy: true,
    ...overrides,
  });

async function main() {
  const online = observe();
  assert.equal(online.mode, "online");
  assert.equal(online.capabilities.remoteWorkforce, true);
  assert.equal(online.capabilities.localInference, true);

  const offline = observe({ browserOnline: false, api: "unknown" });
  assert.equal(offline.mode, "offline");
  assert.equal(offline.capabilities.localRead, true);
  assert.equal(offline.capabilities.localDrafts, true);
  assert.equal(offline.capabilities.localInference, true);
  assert.equal(offline.capabilities.remoteRead, false);
  assert.equal(offline.capabilities.remoteWrite, false);
  assert.equal(offline.capabilities.cloudConnectors, false);
  assert.equal(offline.capabilities.remoteWorkforce, false);
  assert.equal(offline.capabilities.sync, false);

  const offlineWithoutModel = observe({
    browserOnline: false,
    api: "unreachable",
    localModelHealthy: false,
  });
  assert.equal(offlineWithoutModel.mode, "offline");
  assert.equal(offlineWithoutModel.capabilities.localInference, false);

  const degraded = observe({ api: "unreachable" });
  assert.equal(degraded.mode, "degraded");
  assert.equal(degraded.capabilities.localDrafts, true);
  assert.equal(degraded.capabilities.remoteWrite, false);

  const unauthorized = observe({ api: "unauthorized" });
  assert.equal(unauthorized.mode, "degraded");
  assert.equal(unauthorized.capabilities.remoteRead, false);

  const starting = observe({ api: "unknown" });
  assert.equal(starting.mode, "starting");
  assert.equal(starting.capabilities.remoteRead, false);

  const syncing = observe({ syncRequested: true });
  assert.equal(syncing.mode, "syncing");
  assert.equal(syncing.capabilities.sync, true);

  assert.equal(isJarvisActionAllowed(offline, "local_draft", true), true);
  assert.equal(isJarvisActionAllowed(offline, "remote_workforce", true), false);
  assert.equal(isJarvisActionAllowed(offline, "consequential_external", true), false);
  assert.equal(isJarvisActionAllowed(online, "remote_workforce", false), false);
  assert.equal(isJarvisActionAllowed(online, "remote_workforce", true), true);
  assert.equal(isJarvisActionAllowed(online, "consequential_external", true), false);
  assert.equal(isJarvisActionAllowed(offlineWithoutModel, "local_inference", true), false);

  console.log("J.A.R.V.I.S. connectivity and offline capability policy tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
