const SUPPORTED_DESKTOPS = new Set(["win32", "darwin", "linux"]);

export function detectPlatformCapabilities({
  platform = process.platform,
  env = process.env,
  runtime = "node"
} = {}) {
  const isAndroid = platform === "android" ||
    (platform === "linux" && Boolean(env.ANDROID_ROOT || env.ANDROID_DATA));
  const isIos = platform === "ios";
  const target = isIos ? "ios" : isAndroid ? "android" : platform;
  const desktopSupported = SUPPORTED_DESKTOPS.has(platform) && !isAndroid;

  let support;
  let reason;
  if (desktopSupported) {
    support = "prototype-runtime";
    reason = "The current Node.js local prototype can run on this desktop operating system; this does not imply a packaged installer or OS-level service.";
  } else if (isAndroid) {
    support = runtime === "node" ? "experimental-runtime-only" : "not-supported";
    reason = "A Node.js environment may run locally (for example through a terminal environment), but Android background execution, battery policy and packaging are not implemented.";
  } else if (isIos) {
    support = "not-supported";
    reason = "The current Node.js prototype is not an iOS app. A native implementation and iOS platform review are required.";
  } else {
    support = "not-supported";
    reason = "This operating-system target has not been assessed for the current prototype.";
  }

  return Object.freeze({
    target,
    runtime,
    support,
    reason,
    capabilities: Object.freeze({
      localLoopbackHosting: desktopSupported || (isAndroid && runtime === "node"),
      lanHosting: false,
      publicIngress: false,
      backgroundService: false,
      osEnforcedResourceLimits: false,
      workloadIsolation: false,
      packagedInstaller: false
    }),
    releaseBoundary: "prototype-only; no public exposure or arbitrary workload execution"
  });
}
