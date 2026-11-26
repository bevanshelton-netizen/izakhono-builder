import test from "node:test";
import assert from "node:assert/strict";
import { buildNode01DockerPlan, validateNode01DockerPlan } from "./node01-docker-plan.mjs";

const base = {
  sessionId: "session-1234567890",
  runtimeInstanceId: "runtime-1234567890",
  imageReference: `registry.izakhono.local/browser@sha256:${"b".repeat(64)}`,
  isolatedNetworkName: "izakhono-browser-egress-v1",
  proxyHost: "browser-egress-proxy"
};

test("builds an argv-only Docker Engine plan for NODE01 WSL2 Ubuntu", () => {
  const plan = buildNode01DockerPlan(base);
  assert.equal(validateNode01DockerPlan(plan).ok, true);
  assert.equal(plan.platform, "NODE01-WINDOWS-WSL2-UBUNTU-DOCKER-ENGINE");
  assert.equal(plan.executionRules.executable, "docker");
  assert.equal(plan.executionRules.shell, false);
  assert.equal(plan.executionRules.retries, 0);
  assert.ok(plan.createArgv.includes("--read-only"));
  assert.ok(plan.createArgv.includes("--cap-drop"));
  assert.ok(plan.createArgv.includes("ALL"));
  assert.ok(plan.createArgv.includes("--init"));
});

test("pins the image and requires the reviewed seccomp profile", () => {
  const plan = buildNode01DockerPlan(base);
  assert.ok(plan.createArgv.includes(base.imageReference));
  assert.ok(plan.createArgv.includes("seccomp=/etc/izakhono/seccomp/browser-v1.json"));
  assert.throws(() => buildNode01DockerPlan({ ...base, imageReference: "browser:latest" }), /digest_pinned/);
});

test("does not add host mounts, host networking or privileged flags", () => {
  const plan = buildNode01DockerPlan(base);
  assert.equal(plan.createArgv.some(arg => ["-v", "--volume", "--mount", "--privileged", "--network=host"].includes(arg)), false);
  assert.equal(plan.networkPrerequisite.mustBeInternal, true);
  assert.equal(plan.networkPrerequisite.directInternetFromBrowser, false);
  assert.equal(plan.networkPrerequisite.directDnsFromBrowser, false);
});

test("configures a browser-only proxy and disables QUIC", () => {
  const plan = buildNode01DockerPlan(base);
  assert.ok(plan.createArgv.includes("--proxy-server=http://browser-egress-proxy:3128"));
  assert.ok(plan.createArgv.includes("--disable-quic"));
  assert.ok(plan.createArgv.includes("--remote-debugging-pipe"));
  assert.equal(plan.createArgv.includes("--no-sandbox"), false);
});

test("bounds resources and validates network, identity and seccomp inputs", () => {
  assert.throws(() => buildNode01DockerPlan({ ...base, pidsLimit: 99999 }), /pids_limit/);
  assert.throws(() => buildNode01DockerPlan({ ...base, proxyPort: 0 }), /proxy_port/);
  assert.throws(() => buildNode01DockerPlan({ ...base, seccompProfilePath: "../../host/profile" }), /seccomp_profile_path/);
  const plan = buildNode01DockerPlan(base);
  assert.equal(validateNode01DockerPlan({ ...plan, networkPrerequisite: { ...plan.networkPrerequisite, mustBeInternal: false } }).reason, "network_prerequisite_not_isolated");
});

test("exposes explicit start, inspect, kill and removal commands without shell strings", () => {
  const plan = buildNode01DockerPlan(base);
  assert.deepEqual(plan.startArgv.slice(0, 1), ["start"]);
  assert.deepEqual(plan.inspectArgv.slice(0, 1), ["inspect"]);
  assert.deepEqual(plan.killArgv.slice(0, 1), ["kill"]);
  assert.deepEqual(plan.removeArgv.slice(0, 2), ["rm", "--force"]);
  assert.equal(typeof plan.createArgv, "object");
});

test("rejects injected privilege, host-network and security-profile overrides", () => {
  const plan = buildNode01DockerPlan(base);
  assert.equal(validateNode01DockerPlan({ ...plan, createArgv: [...plan.createArgv, "--privileged"] }).reason, "host_mount_forbidden");
  assert.equal(validateNode01DockerPlan({ ...plan, createArgv: [...plan.createArgv, "--network=host"] }).reason, "host_mount_forbidden");
  assert.equal(validateNode01DockerPlan({ ...plan, createArgv: [...plan.createArgv, "seccomp=unconfined"] }).reason, "host_mount_forbidden");
});
