const REQUIRED_LINUX_CONTROLLERS = Object.freeze(["cpu", "memory", "io", "pids"]);

/**
 * Read-only capability preflight. This module never writes cgroups, creates
 * jobs/containers, changes system settings or starts workloads.
 */
export async function inspectResourceEnforcement({
  platform = process.platform,
  probeLinuxCgroupV2 = async () => ({ mounted: false, controllers: [] })
} = {}) {
  if (platform === "linux") {
    let probe;
    try {
      probe = await probeLinuxCgroupV2();
    } catch {
      probe = { mounted: false, controllers: [], error: "probe-failed" };
    }
    const controllers = Array.isArray(probe?.controllers)
      ? [...new Set(probe.controllers.filter(value => typeof value === "string"))]
      : [];
    const missingControllers = REQUIRED_LINUX_CONTROLLERS.filter(name => !controllers.includes(name));
    const available = probe?.mounted === true && missingControllers.length === 0;
    return Object.freeze({
      platform,
      mechanism: "cgroup-v2",
      mechanismDetected: probe?.mounted === true,
      requiredControllers: REQUIRED_LINUX_CONTROLLERS,
      available,
      missingControllers,
      enforcementReady: false,
      isolationReady: false,
      canLaunchManagedWorkloads: false,
      reason: available
        ? "Required cgroup v2 controllers appear available, but no verified enforcement or isolation adapter is installed."
        : "Required cgroup v2 mount/controllers were not confirmed; managed workload launch remains disabled.",
      mode: "read-only-preflight"
    });
  }
  if (platform === "win32") {
    return Object.freeze({
      platform, mechanism: "windows-job-objects", mechanismDetected: false,
      available: false, enforcementReady: false, isolationReady: false,
      canLaunchManagedWorkloads: false,
      reason: "Windows Job Object enforcement is not implemented or verified in this prototype.",
      mode: "read-only-preflight"
    });
  }
  if (platform === "darwin") {
    return Object.freeze({
      platform, mechanism: "macos-resource-controls", mechanismDetected: false,
      available: false, enforcementReady: false, isolationReady: false,
      canLaunchManagedWorkloads: false,
      reason: "A supported macOS process-isolation and resource-control adapter is not implemented or verified.",
      mode: "read-only-preflight"
    });
  }
  return Object.freeze({
    platform, mechanism: "none", mechanismDetected: false, available: false,
    enforcementReady: false, isolationReady: false, canLaunchManagedWorkloads: false,
    reason: "No resource-enforcement adapter is available for this platform.",
    mode: "read-only-preflight"
  });
}

/** Policy approval alone never authorizes managed workload execution. */
export function evaluateManagedWorkloadLaunch({ policyDecision, enforcement, isolation } = {}) {
  const reasons = [];
  if (policyDecision?.allowed !== true) reasons.push("resource-policy-denied");
  if (enforcement?.enforcementReady !== true) reasons.push("os-enforcement-unverified");
  if (isolation?.ready !== true) reasons.push("workload-isolation-unverified");
  return Object.freeze({
    allowed: reasons.length === 0,
    reasons,
    executionEnabled: false,
    note: "No workload launcher is exposed by this prototype; this gate is a fail-closed contract."
  });
}
