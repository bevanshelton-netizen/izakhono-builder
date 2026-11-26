const REQUIRED_CONTROLS = Object.freeze([
  "dedicated_runtime_identity",
  "non_root_user",
  "read_only_root_filesystem",
  "ephemeral_browser_profile",
  "no_host_mounts",
  "no_host_ipc",
  "no_privileged_mode",
  "drop_all_capabilities",
  "no_new_privileges",
  "seccomp_enforced",
  "egress_firewall_enforced",
  "dns_ip_pinning_enforced",
  "metadata_ip_blocked",
  "private_address_space_blocked",
  "resource_limits_enforced",
  "process_tree_supervision",
  "runtime_deadline_enforced",
  "profile_destroy_on_exit",
  "bridge_authenticated"
]);

const FORBIDDEN_NETWORK_MODES = new Set(["host", "bridge_unrestricted", "none_unfiltered"]);
const MAX_ATTESTATION_BYTES = 8192;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/**
 * Validates a runtime driver's claimed isolation evidence before the supervisor
 * may accept a runtime. This is a policy gate, not an OS/container sandbox.
 * Evidence must be produced by a trusted local runtime controller, never by
 * the browser process or untrusted page content.
 */
export function validateIsolationAttestation(attestation, {
  expectedSessionId,
  expectedRuntimeInstanceId,
  expectedPolicyVersion,
  verifySignature,
  now = Date.now()
} = {}) {
  if (!plainObject(attestation)) return { ok: false, reason: "invalid_attestation_shape" };
  const allowedKeys = new Set([
    "sessionId", "runtimeInstanceId", "policyVersion", "networkMode",
    "controls", "issuedAt", "expiresAt", "controllerIdentity", "signature"
  ]);
  if (Object.keys(attestation).some(key => !allowedKeys.has(key))) {
    return { ok: false, reason: "unknown_attestation_field" };
  }
  if (new TextEncoder().encode(JSON.stringify(attestation)).byteLength > MAX_ATTESTATION_BYTES) {
    return { ok: false, reason: "attestation_too_large" };
  }
  if (attestation.sessionId !== expectedSessionId ||
      attestation.runtimeInstanceId !== expectedRuntimeInstanceId ||
      attestation.policyVersion !== expectedPolicyVersion) {
    return { ok: false, reason: "attestation_binding_mismatch" };
  }
  if (typeof attestation.controllerIdentity !== "string" || !attestation.controllerIdentity.trim() ||
      typeof attestation.signature !== "string" || !attestation.signature.trim() ||
      typeof verifySignature !== "function" || verifySignature(attestation) !== true) {
    return { ok: false, reason: "attestation_not_authenticated" };
  }
  if (FORBIDDEN_NETWORK_MODES.has(attestation.networkMode) || attestation.networkMode !== "isolated-egress-proxy-only") {
    return { ok: false, reason: "unsafe_network_mode" };
  }
  if (!Number.isInteger(attestation.issuedAt) || !Number.isInteger(attestation.expiresAt) ||
      !Number.isInteger(now) || attestation.expiresAt <= attestation.issuedAt ||
      attestation.issuedAt > now || now >= attestation.expiresAt) {
    return { ok: false, reason: "invalid_attestation_lifetime" };
  }
  if (!plainObject(attestation.controls)) return { ok: false, reason: "missing_isolation_controls" };
  const missing = REQUIRED_CONTROLS.filter(name => attestation.controls[name] !== true);
  if (missing.length) return { ok: false, reason: "isolation_controls_missing", missing };
  return { ok: true, verifiedClaims: REQUIRED_CONTROLS.length, controllerIdentity: attestation.controllerIdentity };
}

export const BROWSER_ISOLATION_REQUIREMENTS = Object.freeze({
  runtime: Object.freeze({
    user: "dedicated-unprivileged-uid",
    filesystem: "read-only-root-with-ephemeral-writable-profile",
    mounts: "no-host-mounts",
    ipc: "private-authenticated-narrow-bridge-only",
    capabilities: "drop-all",
    privilegeEscalation: false,
    seccomp: "enforced-reviewed-profile",
    resources: Object.freeze({ cpu: "bounded", memory: "bounded", pids: "bounded", wallClock: "bounded" })
  }),
  network: Object.freeze({
    mode: "isolated-egress-proxy-only",
    dns: "resolve-validate-pin-per-navigation",
    deny: Object.freeze(["loopback", "private", "link-local", "multicast", "reserved", "metadata", "ipv4-mapped-ipv6"]),
    redirects: "revalidate-every-hop",
    rebinding: "blocked-by-pinned-address-and-egress-enforcement"
  }),
  lifecycle: Object.freeze({
    profile: "unique-per-session",
    cleanup: Object.freeze(["terminate-entire-process-tree", "destroy-profile", "close-ipc"]),
    uncertainOutcome: "quarantine-no-retry-no-reuse"
  })
});
