const ALLOWED_METHODS = new Set(["navigate", "snapshot", "extract_text", "wait"]);
const MAX_RESULT_BYTES = 64 * 1024;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function bytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requiredFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`driver.${name} must be a function`);
}

/**
 * IZAKHONO-owned orchestration boundary around an injected disposable runtime.
 * This is a contract implementation only: it does not launch OS processes,
 * containers, Chromium, network filters, or persistent storage.
 *
 * Driver methods must be implemented by a separately reviewed isolation layer.
 * Calls are never retried. Any uncertain dispatch result quarantines the session.
 */
export function createBrowserRuntimeSupervisor({ registry, driver, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (!registry || !driver || typeof now !== "function") throw new TypeError("registry, driver and now are required");
  for (const name of ["create", "probeReady", "dispatch", "terminateProcessTree", "destroyProfile", "closeIpc"]) {
    requiredFunction(driver[name], name);
  }

  const runtimes = new Map();
  const quarantined = new Map();

  async function cleanup(runtimeId, context) {
    const outcomes = {};
    for (const [key, fn] of [
      ["processTreeTerminated", driver.terminateProcessTree],
      ["profileDestroyed", driver.destroyProfile],
      ["ipcClosed", driver.closeIpc]
    ]) {
      try { outcomes[key] = (await fn(runtimeId, context)) === true; }
      catch { outcomes[key] = false; }
    }
    const complete = Object.values(outcomes).every(Boolean);
    if (!complete) quarantined.set(runtimeId, Object.freeze({ ...outcomes, at: now() }));
    else {
      runtimes.delete(runtimeId);
      quarantined.delete(runtimeId);
    }
    return { complete, ...outcomes };
  }

  function ownedSession(sessionId, identity) {
    const result = registry.get(sessionId, identity);
    if (!result?.ok) throw new Error(result?.reason ?? "session_lookup_failed");
    return result.session;
  }

  return Object.freeze({
    async start(sessionId, identity) {
      const session = ownedSession(sessionId, identity);
      if (session.state !== "AUTHORISED") return { ok: false, reason: "session_not_authorised" };
      let created;
      try {
        created = await driver.create(Object.freeze({
          sessionId, ownerId: session.ownerId, taskId: session.taskId,
          executionEnvironmentId: session.executionEnvironmentId,
          policyId: session.policyId, policyVersion: session.policyVersion
        }));
        if (!plainObject(created) || typeof created.runtimeInstanceId !== "string" ||
            !created.runtimeInstanceId.trim() || created.runtimeInstanceId.length > 128) {
          throw new Error("invalid_runtime_identity");
        }
        const runtimeId = created.runtimeInstanceId;
        if (runtimes.has(runtimeId) || quarantined.has(runtimeId)) throw new Error("runtime_identity_reuse");
        const started = registry.start(sessionId, identity, { runtimeInstanceId: runtimeId });
        if (!started.ok) throw new Error(started.reason);
        runtimes.set(runtimeId, { sessionId, identity: Object.freeze({ ...identity }), policyVersion: session.policyVersion });
        const ready = await driver.probeReady(runtimeId, Object.freeze({ sessionId, deadline: session.expiresAt }));
        if (ready !== true) throw new Error("runtime_readiness_failed");
        const marked = registry.ready(sessionId, identity);
        if (!marked.ok) throw new Error(marked.reason);
        return { ok: true, runtimeInstanceId: runtimeId, state: marked.state };
      } catch (error) {
        if (created?.runtimeInstanceId) {
          registry.quarantine(sessionId, identity, "runtime_start_failed");
          const cleanupResult = await cleanup(created.runtimeInstanceId, { sessionId, reason: "runtime_start_failed" });
          return { ok: false, reason: "runtime_start_failed", cleanup: cleanupResult };
        }
        return { ok: false, reason: "runtime_creation_failed" };
      }
    },

    async execute(sessionId, identity, request) {
      let session;
      try { session = ownedSession(sessionId, identity); }
      catch (error) { return { ok: false, reason: error.message }; }
      if (session.state !== "READY" || !session.runtimeInstanceId) return { ok: false, reason: "runtime_not_ready" };
      const runtime = runtimes.get(session.runtimeInstanceId);
      if (!runtime || runtime.sessionId !== sessionId ||
          runtime.identity.ownerId !== identity.ownerId ||
          runtime.identity.taskId !== identity.taskId ||
          runtime.identity.executionEnvironmentId !== identity.executionEnvironmentId) {
        registry.quarantine(sessionId, identity, "runtime_binding_mismatch");
        return { ok: false, reason: "runtime_binding_mismatch" };
      }
      if (!plainObject(request) || !ALLOWED_METHODS.has(request.method) ||
          request.policyProfile !== "read_only" || request.policyVersion !== runtime.policyVersion) {
        return { ok: false, reason: "read_only_method_required" };
      }
      const accepted = registry.beginRequest(sessionId, identity, request);
      if (!accepted.ok) return accepted;
      const remaining = request.deadline - now();
      if (remaining <= 0) {
        registry.quarantine(sessionId, identity, "request_deadline_exceeded");
        await cleanup(session.runtimeInstanceId, { sessionId, reason: "request_deadline_exceeded" });
        return { ok: false, reason: "request_timed_out" };
      }

      let timer;
      const controller = new AbortController();
      const timeout = new Promise((_, reject) => {
        timer = setTimer(() => {
          controller.abort("request_deadline_exceeded");
          reject(new Error("request_timed_out"));
        }, remaining);
      });
      try {
        const result = await Promise.race([
          driver.dispatch(session.runtimeInstanceId, Object.freeze({ ...request }), { signal: controller.signal, sessionId }),
          timeout
        ]);
        if (bytes(result) > MAX_RESULT_BYTES) throw new Error("runtime_result_too_large");
        const completed = registry.completeRequest(sessionId, identity, { requestId: request.requestId });
        if (!completed.ok) throw new Error(completed.reason);
        return { ok: true, result };
      } catch (error) {
        controller.abort("runtime_outcome_uncertain");
        registry.quarantine(sessionId, identity, error.message === "request_timed_out" ? "request_deadline_exceeded" : "runtime_dispatch_uncertain");
        const cleanupResult = await cleanup(session.runtimeInstanceId, { sessionId, reason: "runtime_dispatch_uncertain" });
        return { ok: false, reason: error.message === "request_timed_out" ? "request_timed_out" : "runtime_dispatch_uncertain", cleanup: cleanupResult };
      } finally {
        if (timer !== undefined) clearTimer(timer);
      }
    },

    async close(sessionId, identity) {
      let session;
      try { session = ownedSession(sessionId, identity); }
      catch (error) { return { ok: false, reason: error.message }; }
      if (!session.runtimeInstanceId || !runtimes.has(session.runtimeInstanceId)) return { ok: false, reason: "runtime_not_registered" };
      const closing = registry.beginClose(sessionId, identity);
      if (!closing.ok) return closing;
      const cleanupResult = await cleanup(session.runtimeInstanceId, { sessionId, reason: "owner_close" });
      const closed = registry.finishClose(sessionId, identity, cleanupResult);
      return { ok: cleanupResult.complete && closed.ok, state: closed.state ?? "QUARANTINED", cleanup: cleanupResult };
    },

    async cancel(sessionId, identity, reason = "owner_cancelled") {
      let session;
      try { session = ownedSession(sessionId, identity); }
      catch (error) { return { ok: false, reason: error.message }; }
      const cancelled = registry.cancel(sessionId, identity, reason);
      if (!cancelled.ok) return cancelled;
      if (!session.runtimeInstanceId) return { ok: true, state: cancelled.state, cleanup: null };
      const cleanupResult = await cleanup(session.runtimeInstanceId, { sessionId, reason });
      return { ok: cleanupResult.complete, state: cancelled.state, cleanup: cleanupResult };
    },

    getQuarantineSnapshot() {
      return Object.freeze([...quarantined.entries()].map(([runtimeInstanceId, evidence]) =>
        Object.freeze({ runtimeInstanceId, ...evidence })));
    }
  });
}
