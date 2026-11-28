import test from "node:test";
import assert from "node:assert/strict";
import { detectPlatformCapabilities } from "../src/platform-capabilities.mjs";

test("desktop Node.js targets are prototype runtime only", () => {
  for (const platform of ["win32", "darwin", "linux"]) {
    const result = detectPlatformCapabilities({ platform, env: {}, runtime: "node" });
    assert.equal(result.support, "prototype-runtime");
    assert.equal(result.capabilities.localLoopbackHosting, true);
    assert.equal(result.capabilities.lanHosting, false);
    assert.equal(result.capabilities.osEnforcedResourceLimits, false);
    assert.equal(result.capabilities.workloadIsolation, false);
  }
});

test("Android is detected from common Android environment markers", () => {
  const result = detectPlatformCapabilities({
    platform: "linux",
    env: { ANDROID_ROOT: "/system" },
    runtime: "node"
  });
  assert.equal(result.target, "android");
  assert.equal(result.support, "experimental-runtime-only");
  assert.equal(result.capabilities.localLoopbackHosting, true);
  assert.equal(result.capabilities.backgroundService, false);
});

test("iOS is not represented as a supported Node.js target", () => {
  const result = detectPlatformCapabilities({ platform: "ios", env: {}, runtime: "node" });
  assert.equal(result.support, "not-supported");
  assert.equal(result.capabilities.localLoopbackHosting, false);
});

test("unknown platforms fail closed", () => {
  const result = detectPlatformCapabilities({ platform: "plan9", env: {}, runtime: "node" });
  assert.equal(result.support, "not-supported");
  assert.equal(result.capabilities.publicIngress, false);
});
