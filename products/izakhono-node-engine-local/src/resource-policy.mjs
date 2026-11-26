const PROFILES = new Set(["quiet", "balanced", "performance"]);

export const DEFAULT_RESOURCE_POLICY = Object.freeze({
  profile: "balanced",
  maxMemoryMb: 512,
  maxCpuPercent: 25,
  maxDiskMb: 1024,
  pauseOnBattery: true,
  pauseOnThermalWarning: true,
  pauseWhenUserRequests: true
});

export function validateResourcePolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new TypeError("resource policy must be an object");
  }
  if (!PROFILES.has(policy.profile)) throw new RangeError("profile must be quiet, balanced, or performance");
  for (const [key, min, max] of [
    ["maxMemoryMb", 64, 1_048_576],
    ["maxCpuPercent", 1, 100],
    ["maxDiskMb", 64, 1_048_576]
  ]) {
    if (!Number.isInteger(policy[key]) || policy[key] < min || policy[key] > max) {
      throw new RangeError(`${key} must be an integer from ${min} to ${max}`);
    }
  }
  for (const key of ["pauseOnBattery", "pauseOnThermalWarning", "pauseWhenUserRequests"]) {
    if (typeof policy[key] !== "boolean") throw new TypeError(`${key} must be boolean`);
  }
  return Object.freeze({ ...policy });
}

// This is a conservative admission decision, not an OS-enforced CPU/RAM quota.
// The runtime must still implement platform-specific enforcement before claiming hard limits.
export function evaluateWorkloadAdmission({ policy = DEFAULT_RESOURCE_POLICY, requestedMemoryMb = 0, userPaused = false, onBattery = false, thermalWarning = false } = {}) {
  const safePolicy = validateResourcePolicy(policy);
  if (!Number.isInteger(requestedMemoryMb) || requestedMemoryMb < 0) {
    throw new RangeError("requestedMemoryMb must be a non-negative integer");
  }
  const reasons = [];
  if (userPaused && safePolicy.pauseWhenUserRequests) reasons.push("paused-by-owner");
  if (onBattery && safePolicy.pauseOnBattery) reasons.push("battery-power");
  if (thermalWarning && safePolicy.pauseOnThermalWarning) reasons.push("thermal-warning");
  if (requestedMemoryMb > safePolicy.maxMemoryMb) reasons.push("memory-budget-exceeded");
  return Object.freeze({ allowed: reasons.length === 0, reasons, policy: safePolicy, enforcement: "admission-control-only" });
}
