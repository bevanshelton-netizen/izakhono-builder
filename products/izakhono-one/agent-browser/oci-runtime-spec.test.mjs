import test from "node:test";
import assert from "node:assert/strict";
import { buildBrowserOciSpec, validateBrowserOciSpec } from "./oci-runtime-spec.mjs";

const base = {
  sessionId: "session-1",
  runtimeInstanceId: "runtime-1",
  imageDigest: `sha256:${"a".repeat(64)}`,
  egressNetworkId: "isolated-egress-v1",
  seccompProfileRef: "browser-seccomp-v1"
};

test("builds a deterministic non-root, read-only, isolated browser OCI spec", () => {
  const spec = buildBrowserOciSpec(base);
  assert.equal(validateBrowserOciSpec(spec).ok, true);
  assert.equal(spec.process.user.uid, 10001);
  assert.equal(spec.root.readOnly, true);
  assert.equal(spec.network.directEgress, false);
  assert.equal(spec.network.directDns, false);
  assert.deepEqual(spec.linux.capabilities.bounding, []);
  assert.equal(spec.lifecycle.retries, 0);
});

test("rejects mutable image tags and malformed identities", () => {
  assert.throws(() => buildBrowserOciSpec({ ...base, imageDigest: "latest" }), /pinned_sha256/);
  assert.throws(() => buildBrowserOciSpec({ ...base, sessionId: "../host" }), /session_id/);
  assert.throws(() => buildBrowserOciSpec({ ...base, runtimeInstanceId: "" }), /runtime_instance_id/);
});

test("rejects resource limits outside the bounded envelope", () => {
  assert.throws(() => buildBrowserOciSpec({ ...base, limits: { pids: 10000 } }), /pids_limit/);
  assert.throws(() => buildBrowserOciSpec({ ...base, limits: { memoryBytes: 1 } }), /memory_limit/);
});

test("rejects host bind mounts and writable root filesystems", () => {
  const spec = buildBrowserOciSpec(base);
  assert.equal(validateBrowserOciSpec({ ...spec, mounts: [{ type: "bind", source: "/", destination: "/host" }] }).reason, "host_mount_forbidden");
  assert.equal(validateBrowserOciSpec({ ...spec, root: { readOnly: false } }).reason, "required_isolation_control_missing");
});

test("rejects direct network egress, missing namespaces and retained capabilities", () => {
  const spec = buildBrowserOciSpec(base);
  assert.equal(validateBrowserOciSpec({ ...spec, network: { ...spec.network, directEgress: true } }).reason, "required_isolation_control_missing");
  assert.equal(validateBrowserOciSpec({ ...spec, namespaces: ["mount", "pid"] }).reason, "namespace_isolation_incomplete");
  assert.equal(validateBrowserOciSpec({ ...spec, linux: { ...spec.linux, capabilities: { ...spec.linux.capabilities, bounding: ["NET_ADMIN"] } } }).reason, "capabilities_must_be_dropped");
});

test("rejects unsafe retry and cleanup policies", () => {
  const spec = buildBrowserOciSpec(base);
  assert.equal(validateBrowserOciSpec({ ...spec, lifecycle: { ...spec.lifecycle, retries: 1 } }).reason, "unsafe_runtime_lifecycle");
});
