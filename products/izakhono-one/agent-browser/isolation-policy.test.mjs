import test from "node:test";
import assert from "node:assert/strict";
import { BROWSER_ISOLATION_REQUIREMENTS, validateIsolationAttestation } from "./isolation-policy.mjs";

const identity = {
  expectedSessionId: "session-1",
  expectedRuntimeInstanceId: "runtime-1",
  expectedPolicyVersion: "policy-v1",
  verifySignature: attestation => attestation.signature === "trusted-test-signature"
};
function attestation(overrides = {}) {
  const controls = Object.fromEntries([
    "dedicated_runtime_identity", "non_root_user", "read_only_root_filesystem",
    "ephemeral_browser_profile", "no_host_mounts", "no_host_ipc", "no_privileged_mode",
    "drop_all_capabilities", "no_new_privileges", "seccomp_enforced",
    "egress_firewall_enforced", "dns_ip_pinning_enforced", "metadata_ip_blocked",
    "private_address_space_blocked", "resource_limits_enforced", "process_tree_supervision",
    "runtime_deadline_enforced", "profile_destroy_on_exit", "bridge_authenticated"
  ].map(key => [key, true]));
  return {
    sessionId: "session-1", runtimeInstanceId: "runtime-1", policyVersion: "policy-v1",
    networkMode: "isolated-egress-proxy-only", controls, issuedAt: 1000, expiresAt: 2000,
    controllerIdentity: "izakhono-runtime-controller", signature: "trusted-test-signature",
    ...overrides
  };
}

test("accepts a correctly bound attestation only with trusted signature verification", () => {
  const result = validateIsolationAttestation(attestation(), identity);
  assert.equal(result.ok, true);
  assert.equal(result.verifiedClaims, 19);
});

test("rejects absent signature verifier and invalid signatures", () => {
  assert.equal(validateIsolationAttestation(attestation(), { ...identity, verifySignature: undefined }).reason, "attestation_not_authenticated");
  assert.equal(validateIsolationAttestation(attestation({ signature: "forged" }), identity).reason, "attestation_not_authenticated");
});

test("rejects session, runtime and policy binding mismatches", () => {
  assert.equal(validateIsolationAttestation(attestation({ sessionId: "other" }), identity).reason, "attestation_binding_mismatch");
  assert.equal(validateIsolationAttestation(attestation({ runtimeInstanceId: "other" }), identity).reason, "attestation_binding_mismatch");
  assert.equal(validateIsolationAttestation(attestation({ policyVersion: "old" }), identity).reason, "attestation_binding_mismatch");
});

test("rejects forbidden network modes", () => {
  for (const networkMode of ["host", "bridge_unrestricted", "none_unfiltered"]) {
    assert.equal(validateIsolationAttestation(attestation({ networkMode }), identity).reason, "unsafe_network_mode");
  }
});

test("rejects missing or false isolation controls", () => {
  const controls = { ...attestation().controls, no_host_mounts: false };
  const result = validateIsolationAttestation(attestation({ controls }), identity);
  assert.equal(result.reason, "isolation_controls_missing");
  assert.ok(result.missing.includes("no_host_mounts"));
});

test("rejects expired or malformed attestation lifetime", () => {
  assert.equal(validateIsolationAttestation(attestation({ issuedAt: 2000, expiresAt: 1000 }), identity).reason, "invalid_attestation_lifetime");
});

test("rejects unknown fields and oversized attestations", () => {
  assert.equal(validateIsolationAttestation(attestation({ hostCommand: "sh" }), identity).reason, "unknown_attestation_field");
  assert.equal(validateIsolationAttestation(attestation({ controllerIdentity: "x".repeat(9000) }), identity).reason, "attestation_too_large");
});

test("publishes explicit isolation requirements without claiming they are deployed", () => {
  assert.equal(BROWSER_ISOLATION_REQUIREMENTS.runtime.privilegeEscalation, false);
  assert.equal(BROWSER_ISOLATION_REQUIREMENTS.network.mode, "isolated-egress-proxy-only");
  assert.ok(BROWSER_ISOLATION_REQUIREMENTS.lifecycle.cleanup.includes("terminate-entire-process-tree"));
});
