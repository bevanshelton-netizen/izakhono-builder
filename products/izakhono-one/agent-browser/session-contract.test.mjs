import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserSessionRegistry } from "./session-contract.mjs";

function fixture() {
  let time = 1_800_000_000_000;
  let sequence = 0;
  const events = [];
  const registry = createBrowserSessionRegistry({
    now: () => time,
    createId: () => `id-${++sequence}`,
    maxSessionMs: 60_000,
    maxRequestMs: 5_000,
    audit: event => events.push(event)
  });
  const identity = { ownerId: "owner-1", taskId: "task-1", executionEnvironmentId: "env-1" };
  const created = registry.request({ ...identity, policyId: "policy-read", policyVersion: "v1" });
  assert.equal(created.ok, true);
  return { registry, identity, sessionId: created.session.id, events, advance: ms => { time += ms; } };
}

function readyFixture() {
  const f = fixture();
  assert.equal(f.registry.authorise(f.sessionId, f.identity, { allowed: true }).state, "AUTHORISED");
  assert.equal(f.registry.start(f.sessionId, f.identity, { runtimeInstanceId: "runtime-1" }).state, "STARTING");
  assert.equal(f.registry.ready(f.sessionId, f.identity).state, "READY");
  return f;
}

test("session binds owner, task and execution environment", () => {
  const f = fixture();
  assert.equal(f.registry.get(f.sessionId, { ...f.identity, ownerId: "other" }).reason, "session_binding_mismatch");
  assert.equal(f.registry.authorise(f.sessionId, f.identity, { allowed: true }).state, "AUTHORISED");
});

test("denied session cannot start", () => {
  const f = fixture();
  assert.equal(f.registry.authorise(f.sessionId, f.identity, { allowed: false }).state, "DENIED");
  assert.equal(f.registry.start(f.sessionId, f.identity, { runtimeInstanceId: "runtime-1" }).reason, "invalid_session_state");
});

test("runtime must be ready before read-only request", () => {
  const f = fixture();
  f.registry.authorise(f.sessionId, f.identity, { allowed: true });
  assert.equal(f.registry.beginRequest(f.sessionId, f.identity, {}).reason, "session_not_idle");
});

test("accepts bounded read-only navigation and returns to ready on completion", () => {
  const f = readyFixture();
  const started = f.registry.beginRequest(f.sessionId, f.identity, {
    requestId: "req-1", method: "navigate", url: "https://example.org/",
    deadline: 1_800_000_000_004, policyProfile: "read_only", policyVersion: "v1"
  });
  assert.equal(started.ok, true);
  assert.equal(f.registry.get(f.sessionId, f.identity).session.state, "RUNNING");
  assert.equal(f.registry.completeRequest(f.sessionId, f.identity, { requestId: "req-1" }).state, "READY");
});

test("rejects write-capable, unknown, oversized and policy-mismatched requests", () => {
  const f = readyFixture();
  const base = { requestId: "req", deadline: 1_800_000_000_004, policyProfile: "read_only", policyVersion: "v1" };
  assert.equal(f.registry.beginRequest(f.sessionId, f.identity, { ...base, method: "click" }).reason, "method_not_allowed");
  assert.equal(f.registry.beginRequest(f.sessionId, f.identity, { ...base, method: "navigate", extra: true }).reason, "invalid_request_shape");
  assert.equal(f.registry.beginRequest(f.sessionId, f.identity, { ...base, method: "navigate", url: "https://example.org/", policyVersion: "v2" }).reason, "policy_binding_mismatch");
  assert.equal(f.registry.beginRequest(f.sessionId, f.identity, { ...base, method: "navigate", url: "x".repeat(17000) }).reason, "request_too_large");
});

test("does not accept a completion for a different request", () => {
  const f = readyFixture();
  f.registry.beginRequest(f.sessionId, f.identity, {
    requestId: "req-1", method: "snapshot", deadline: 1_800_000_000_004,
    policyProfile: "read_only", policyVersion: "v1"
  });
  assert.equal(f.registry.completeRequest(f.sessionId, f.identity, { requestId: "req-2" }).reason, "request_binding_mismatch");
});

test("deadline expiry quarantines an uncertain in-flight runtime", () => {
  const f = readyFixture();
  f.registry.beginRequest(f.sessionId, f.identity, {
    requestId: "req-1", method: "wait", deadline: 1_800_000_000_004,
    policyProfile: "read_only", policyVersion: "v1"
  });
  f.advance(5);
  assert.equal(f.registry.completeRequest(f.sessionId, f.identity, { requestId: "req-1" }).reason, "request_timed_out");
  assert.equal(f.registry.get(f.sessionId, f.identity).session.state, "QUARANTINED");
});

test("cancellation clears pending work and signals runtime termination requirement", () => {
  const f = readyFixture();
  f.registry.beginRequest(f.sessionId, f.identity, {
    requestId: "req-1", method: "wait", deadline: 1_800_000_000_004,
    policyProfile: "read_only", policyVersion: "v1"
  });
  const result = f.registry.cancel(f.sessionId, f.identity);
  assert.equal(result.state, "CANCELLED");
  assert.equal(result.runtimeMustBeTerminated, true);
  assert.equal(f.registry.get(f.sessionId, f.identity).reason, "session_terminal");
});

test("close succeeds only when process, profile and IPC cleanup are confirmed", () => {
  const f = readyFixture();
  assert.equal(f.registry.beginClose(f.sessionId, f.identity).state, "CLOSING");
  assert.equal(f.registry.finishClose(f.sessionId, f.identity, {
    processTreeTerminated: true, profileDestroyed: true, ipcClosed: false
  }).reason, "cleanup_not_confirmed");
  assert.equal(f.registry.get(f.sessionId, f.identity).session.state, "QUARANTINED");
});

test("successful close records terminal cleanup and audit evidence", () => {
  const f = readyFixture();
  f.registry.beginClose(f.sessionId, f.identity);
  assert.equal(f.registry.finishClose(f.sessionId, f.identity, {
    processTreeTerminated: true, profileDestroyed: true, ipcClosed: true
  }).state, "CLOSED");
  const names = f.events.map(event => event.event_type);
  assert.ok(names.includes("session.requested"));
  assert.ok(names.includes("session.authorised"));
  assert.ok(names.includes("runtime.started"));
  assert.ok(names.includes("runtime.ready"));
  assert.ok(names.includes("runtime.terminated"));
  assert.ok(names.includes("profile.destroyed"));
  assert.ok(names.includes("session.closed"));
});

test("session expiry is terminal and prevents further operations", () => {
  const f = fixture();
  f.advance(60_000);
  assert.equal(f.registry.authorise(f.sessionId, f.identity, { allowed: true }).reason, "session_expired");
  assert.equal(f.registry.get(f.sessionId, f.identity).reason, "session_expired");
});
