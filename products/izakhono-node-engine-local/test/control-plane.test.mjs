import test from "node:test";
import assert from "node:assert/strict";
import { createControlPlane } from "../src/control-plane.mjs";
function fakeEngine() {
  let state = "stopped";
  return { start: async () => (state = "running", { state, url: "http://127.0.0.1:4321/" }), stop: async () => (state = "stopped", { state, url: null }), status: () => ({ state, url: state === "running" ? "http://127.0.0.1:4321/" : null }) };
}
test("control plane is loopback-only and reports engine plus device snapshot", async t => {
  const plane = createControlPlane({ engine: fakeEngine(), port: 0 });
  const status = await plane.start();
  t.after(() => plane.stop());
  assert.equal(status.exposure, "loopback");
  const response = await fetch(status.url + "api/status");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.engine.state, "stopped");
  assert.ok(data.system.totalMemoryMb > 0);
  assert.equal(data.measurements, "controller-process-and-system-snapshot; not per-workload quotas");
});
test("control plane serves the local dashboard", async t => {
  const plane = createControlPlane({ engine: fakeEngine(), port: 0 });
  const status = await plane.start();
  t.after(() => plane.stop());
  const response = await fetch(status.url);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Start hosting/);
  assert.ok(response.headers.get("content-security-policy"));
});
test("control actions require same-origin browser requests", async t => {
  const plane = createControlPlane({ engine: fakeEngine(), port: 0 });
  const status = await plane.start();
  t.after(() => plane.stop());
  const denied = await fetch(status.url + "api/start", { method: "POST" });
  assert.equal(denied.status, 403);
  const origin = status.url.slice(0, -1);
  const allowed = await fetch(status.url + "api/start", { method: "POST", headers: { origin } });
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).engine.state, "running");
});
test("control plane rejects non-loopback configuration", () => {
  assert.throws(() => createControlPlane({ engine: fakeEngine(), host: "0.0.0.0" }), /127.0.0.1/);
});
