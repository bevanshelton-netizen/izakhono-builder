import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserSessionRegistry } from "./session-contract.mjs";
import { createBrowserRuntimeSupervisor } from "./runtime-supervisor.mjs";

function fixture(overrides = {}) {
  let time = 1_800_000_000_000;
  let sequence = 0;
  const calls = [];
  const registry = createBrowserSessionRegistry({
    now: () => time, createId: () => `id-${++sequence}`,
    maxSessionMs: 60_000, maxRequestMs: 5_000
  });
  const identity = { ownerId: "owner-1", taskId: "task-1", executionEnvironmentId: "env-1" };
  const session = registry.request({ ...identity, policyId: "read-policy", policyVersion: "v1" }).session;
  registry.authorise(session.id, identity, { allowed: true });
  const driver = {
    async create() { calls.push("create"); return { runtimeInstanceId: "runtime-1" }; },
    async probeReady() { calls.push("probeReady"); return true; },
    async dispatch(_id, request, { signal }) {
      calls.push(`dispatch:${request.method}`);
      if (overrides.dispatch) return overrides.dispatch({ request, signal, calls });
      return { title: "Fixture page", text: "Read-only observation" };
    },
    async terminateProcessTree() { calls.push("terminate"); return overrides.terminate !== false; },
    async destroyProfile() { calls.push("destroyProfile"); return overrides.destroyProfile !== false; },
    async closeIpc() { calls.push("closeIpc"); return overrides.closeIpc !== false; }
  };
  const supervisor = createBrowserRuntimeSupervisor({ registry, driver, now: () => time });
  const ready = async () => {
    const result = await supervisor.start(session.id, identity);
    assert.equal(result.ok, true);
    return result;
  };
  const request = (method = "snapshot") => ({
    requestId: "request-1", method, deadline: time + 4_000,
    policyProfile: "read_only", policyVersion: "v1"
  });
  return { registry, identity, session, supervisor, calls, ready, request, advance: ms => { time += ms; } };
}

test("starts only an authorised session and binds the runtime", async () => {
  const f = fixture();
  const result = await f.ready();
  assert.equal(result.runtimeInstanceId, "runtime-1");
  assert.equal(f.registry.get(f.session.id, f.identity).session.state, "READY");
  assert.deepEqual(f.calls.slice(0, 2), ["create", "probeReady"]);
});

test("rejects owner, task and environment mismatches before dispatch", async () => {
  const f = fixture();
  await f.ready();
  const result = await f.supervisor.execute(f.session.id, { ...f.identity, taskId: "other" }, f.request());
  assert.equal(result.reason, "session_binding_mismatch");
  assert.equal(f.calls.includes("dispatch:snapshot"), false);
});

test("dispatches only read-only methods through the narrow driver bridge", async () => {
  const f = fixture();
  await f.ready();
  const result = await f.supervisor.execute(f.session.id, f.identity, f.request("extract_text"));
  assert.equal(result.ok, true);
  assert.equal(result.result.text, "Read-only observation");
  assert.ok(f.calls.includes("dispatch:extract_text"));
});

test("rejects write-capable and mismatched-policy requests without dispatch", async () => {
  const f = fixture();
  await f.ready();
  assert.equal((await f.supervisor.execute(f.session.id, f.identity, f.request("click"))).reason, "read_only_method_required");
  assert.equal((await f.supervisor.execute(f.session.id, f.identity, { ...f.request(), policyVersion: "v2" })).reason, "read_only_method_required");
  assert.equal(f.calls.some(call => call.startsWith("dispatch:")), false);
});

test("oversized runtime observations quarantine and clean up the runtime", async () => {
  const f = fixture({ dispatch: async () => ({ text: "x".repeat(70_000) }) });
  await f.ready();
  const result = await f.supervisor.execute(f.session.id, f.identity, f.request());
  assert.equal(result.ok, false);
  assert.equal(result.reason, "runtime_dispatch_uncertain");
  assert.equal(f.registry.get(f.session.id, f.identity).session.state, "QUARANTINED");
  assert.ok(f.calls.includes("terminate"));
});

test("uncertain dispatch is never retried and causes quarantine", async () => {
  const f = fixture({ dispatch: async () => { throw new Error("bridge_lost"); } });
  await f.ready();
  const result = await f.supervisor.execute(f.session.id, f.identity, f.request());
  assert.equal(result.reason, "runtime_dispatch_uncertain");
  assert.equal(f.calls.filter(call => call === "dispatch:snapshot").length, 1);
  assert.equal(f.registry.get(f.session.id, f.identity).session.state, "QUARANTINED");
});

test("request deadline aborts and terminates rather than retrying", async () => {
  const f = fixture({ dispatch: async () => new Promise(() => {}) });
  await f.ready();
  const result = await f.supervisor.execute(f.session.id, f.identity, { ...f.request(), deadline: Date.now() + 25 });
  assert.equal(result.reason, "request_timed_out");
  assert.equal(f.calls.filter(call => call === "dispatch:snapshot").length, 1);
  assert.ok(f.calls.includes("terminate"));
});

test("failed cleanup is retained in quarantine evidence", async () => {
  const f = fixture({ closeIpc: false });
  await f.ready();
  const result = await f.supervisor.close(f.session.id, f.identity);
  assert.equal(result.ok, false);
  assert.equal(result.state, "QUARANTINED");
  assert.equal(f.supervisor.getQuarantineSnapshot()[0].ipcClosed, false);
});

test("successful close confirms process, profile and IPC cleanup", async () => {
  const f = fixture();
  await f.ready();
  const result = await f.supervisor.close(f.session.id, f.identity);
  assert.equal(result.ok, true);
  assert.equal(result.state, "CLOSED");
  assert.ok(f.calls.includes("terminate"));
  assert.ok(f.calls.includes("destroyProfile"));
  assert.ok(f.calls.includes("closeIpc"));
});

test("runtime creation failure does not dispatch or claim a ready session", async () => {
  const f = fixture();
  // A readiness failure occurs after a runtime identity has been allocated.
  const broken = createBrowserRuntimeSupervisor({
    registry: f.registry,
    driver: {
      async create() { return { runtimeInstanceId: "runtime-bad" }; },
      async probeReady() { return false; },
      async dispatch() { throw new Error("must_not_dispatch"); },
      async terminateProcessTree() { return true; },
      async destroyProfile() { return true; },
      async closeIpc() { return true; }
    }
  });
  const result = await broken.start(f.session.id, f.identity);
  assert.equal(result.ok, false);
  assert.equal(f.registry.get(f.session.id, f.identity).session.state, "QUARANTINED");
});
