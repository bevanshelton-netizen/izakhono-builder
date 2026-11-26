const TERMINAL = new Set(["DENIED", "FAILED", "EXPIRED", "CANCELLED", "CLOSED", "QUARANTINED"]);
const TRANSITIONS = Object.freeze({
  REQUESTED: new Set(["AUTHORISED", "DENIED", "CANCELLED", "EXPIRED"]),
  AUTHORISED: new Set(["STARTING", "CANCELLED", "EXPIRED"]),
  STARTING: new Set(["READY", "FAILED", "CANCELLED", "EXPIRED", "QUARANTINED"]),
  READY: new Set(["RUNNING", "CLOSING", "CANCELLED", "EXPIRED", "QUARANTINED"]),
  RUNNING: new Set(["READY", "CLOSING", "CANCELLED", "EXPIRED", "QUARANTINED"]),
  CLOSING: new Set(["CLOSED", "QUARANTINED"]),
  DENIED: new Set(), FAILED: new Set(), EXPIRED: new Set(),
  CANCELLED: new Set(), CLOSED: new Set(), QUARANTINED: new Set()
});

const METHODS = new Set(["navigate", "snapshot", "extract_text", "wait", "close", "cancel"]);
const MAX_MESSAGE_BYTES = 16 * 1024;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function safeEqual(left, right) {
  return typeof left === "string" && left.length > 0 && left === right;
}

/**
 * In-memory reference contract for browser-session orchestration.
 * This module does not launch a browser, create a process, or provide persistence.
 * Production callers must place it behind authenticated server-side policy,
 * durable audit storage, and an isolated runtime supervisor.
 */
export function createBrowserSessionRegistry({
  now = () => Date.now(),
  createId = () => globalThis.crypto.randomUUID(),
  maxSessionMs = 15 * 60 * 1000,
  maxRequestMs = 30 * 1000,
  audit = () => {}
} = {}) {
  if (typeof now !== "function" || typeof createId !== "function" || typeof audit !== "function") {
    throw new TypeError("now, createId and audit must be functions");
  }
  if (!Number.isInteger(maxSessionMs) || maxSessionMs < 1000 ||
      !Number.isInteger(maxRequestMs) || maxRequestMs < 100) {
    throw new RangeError("invalid session or request duration limit");
  }

  const sessions = new Map();
  const emit = (session, eventType, facts = {}) => {
    const event = Object.freeze({
      event_id: createId(),
      event_type: eventType,
      occurred_at: new Date(now()).toISOString(),
      owner_id: session.ownerId,
      task_id: session.taskId,
      session_id: session.id,
      runtime_instance_id: session.runtimeInstanceId ?? null,
      policy_id: session.policyId,
      policy_version: session.policyVersion,
      ...facts
    });
    audit(event);
    return event;
  };

  function getOwned(sessionId, identity) {
    const session = sessions.get(sessionId);
    if (!session) return { error: "session_not_found" };
    if (!plainObject(identity) || !safeEqual(identity.ownerId, session.ownerId) ||
        !safeEqual(identity.taskId, session.taskId) ||
        !safeEqual(identity.executionEnvironmentId, session.executionEnvironmentId)) {
      return { error: "session_binding_mismatch" };
    }
    return { session };
  }

  function transition(session, next, reason) {
    if (!TRANSITIONS[session.state]?.has(next)) {
      return { ok: false, reason: "invalid_state_transition", state: session.state, target: next };
    }
    session.state = next;
    session.updatedAt = now();
    emit(session, "session.state_changed", { state: next, reason_code: reason ?? null });
    return { ok: true, state: next };
  }

  function expireIfNeeded(session) {
    if (!TERMINAL.has(session.state) && now() >= session.expiresAt) {
      transition(session, "EXPIRED", "session_deadline_exceeded");
      session.pendingRequest = null;
      return true;
    }
    return false;
  }

  function snapshot(session) {
    return Object.freeze({
      id: session.id,
      ownerId: session.ownerId,
      taskId: session.taskId,
      executionEnvironmentId: session.executionEnvironmentId,
      policyId: session.policyId,
      policyVersion: session.policyVersion,
      state: session.state,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      runtimeInstanceId: session.runtimeInstanceId ?? null,
      pendingRequest: session.pendingRequest ? Object.freeze({ ...session.pendingRequest }) : null
    });
  }

  return Object.freeze({
    request({ ownerId, taskId, executionEnvironmentId, policyId, policyVersion }) {
      for (const [key, value] of Object.entries({ ownerId, taskId, executionEnvironmentId, policyId, policyVersion })) {
        if (typeof value !== "string" || value.trim().length === 0 || value.length > 128) {
          return { ok: false, reason: `invalid_${key}` };
        }
      }
      const id = createId();
      if (sessions.has(id)) return { ok: false, reason: "duplicate_session_id" };
      const createdAt = now();
      const session = {
        id, ownerId, taskId, executionEnvironmentId, policyId, policyVersion,
        state: "REQUESTED", createdAt, updatedAt: createdAt,
        expiresAt: createdAt + maxSessionMs, pendingRequest: null
      };
      sessions.set(id, session);
      emit(session, "session.requested");
      return { ok: true, session: snapshot(session) };
    },

    authorise(sessionId, identity, { allowed, reason = "policy_decision" } = {}) {
      const found = getOwned(sessionId, identity);
      if (found.error) return { ok: false, reason: found.error };
      const session = found.session;
      if (expireIfNeeded(session)) return { ok: false, reason: "session_expired" };
      if (session.state !== "REQUESTED") return { ok: false, reason: "invalid_session_state" };
      if (allowed !== true) {
        transition(session, "DENIED", reason);
        emit(session, "session.denied", { reason_code: reason });
        return { ok: true, state: session.state };
      }
      transition(session, "AUTHORISED", reason);
      emit(session, "session.authorised", { decision: "allow" });
      return { ok: true, state: session.state };
    },

    start(sessionId, identity, { runtimeInstanceId } = {}) {
      const found = getOwned(sessionId, identity);
      if (found.error) return { ok: false, reason: found.error };
      const session = found.session;
      if (expireIfNeeded(session)) return { ok: false, reason: "session_expired" };
      if (session.state !== "AUTHORISED") return { ok: false, reason: "invalid_session_state" };
      if (typeof runtimeInstanceId !== "string" || !runtimeInstanceId.trim() || runtimeInstanceId.length > 128) {
        return { ok: false, reason: "invalid_runtime_instance_id" };
      }
      session.runtimeInstanceId = runtimeInstanceId;
      transition(session, "STARTING");
      emit(session, "runtime.started");
      return { ok: true, state: session.state };
    },

    ready(sessionId, identity) {
      const found = getOwned(sessionId, identity);
      if (found.error) return { ok: false, reason: found.error };
      const session = found.session;
      if (expireIfNeeded(session)) return { ok: false, reason: "session_expired" };
      if (session.state !== "STARTING" || !session.runtimeInstanceId) {
        return { ok: false, reason: "runtime_not_starting" };
      }
      transition(session, "READY");
      emit(session, "runtime.ready");
      return { ok: true, state: session.state };
    },

    beginRequest(sessionId, identity, request) {
      const found = getOwned(sessionId, identity);
      if (found.error) return { ok: false, reason: found.error };
      const session = found.session;
      if (expireIfNeeded(session)) return { ok: false, reason: "session_expired" };
      if (session.state !== "READY" || session.pendingRequest) return { ok: false, reason: "session_not_idle" };
      if (!plainObject(request) || Object.keys(request).some(key =>
        !["requestId", "method", "deadline", "policyProfile", "policyVersion", "url", "textOffset", "timeoutMs"].includes(key))) {
        return { ok: false, reason: "invalid_request_shape" };
      }
      if (typeof request.requestId !== "string" || !request.requestId.trim() || request.requestId.length > 128) {
        return { ok: false, reason: "invalid_request_id" };
      }
      if (!METHODS.has(request.method)) return { ok: false, reason: "method_not_allowed" };
      if (request.method === "close" || request.method === "cancel") {
        return { ok: false, reason: "use_session_control_operation" };
      }
      if (typeof request.policyProfile !== "string" || request.policyProfile !== "read_only" ||
          request.policyVersion !== session.policyVersion) {
        return { ok: false, reason: "policy_binding_mismatch" };
      }
      const current = now();
      if (!Number.isInteger(request.deadline) || request.deadline <= current ||
          request.deadline > current + maxRequestMs) return { ok: false, reason: "invalid_request_deadline" };
      if (request.method !== "navigate" && request.url !== undefined) return { ok: false, reason: "unexpected_request_argument" };\n      if (request.method !== "extract_text" && request.textOffset !== undefined) return { ok: false, reason: "unexpected_request_argument" };\n      if (request.method !== "wait" && request.timeoutMs !== undefined) return { ok: false, reason: "unexpected_request_argument" };\n      if (request.method === "navigate" && (typeof request.url !== "string" || request.url.length > 2048)) {
        return { ok: false, reason: "invalid_navigation_target" };
      }
      if (request.method === "extract_text" && request.textOffset !== undefined &&
          (!Number.isInteger(request.textOffset) || request.textOffset < 0 || request.textOffset > 1000000)) {
        return { ok: false, reason: "invalid_text_offset" };
      }
      if (request.method === "wait" && request.timeoutMs !== undefined &&
          (!Number.isInteger(request.timeoutMs) || request.timeoutMs < 0 || request.timeoutMs > maxRequestMs)) {
        return { ok: false, reason: "invalid_wait_timeout" };
      }
      if (byteLength(request) > MAX_MESSAGE_BYTES) return { ok: false, reason: "request_too_large" };
      session.pendingRequest = { requestId: request.requestId, method: request.method, deadline: request.deadline };
      transition(session, "RUNNING");
      emit(session, "request.accepted", { request_id: request.requestId, method: request.method });
      return { ok: true, requestId: request.requestId, deadline: request.deadline };
    },

    completeRequest(sessionId, identity, { requestId, outcome = "completed", resultCode = "ok" } = {}) {
      const found = getOwned(sessionId, identity);
      if (found.error) return { ok: false, reason: found.error };
      const session = found.session;
      if (expireIfNeeded(session)) return { ok: false, reason: "session_expired" };
      if (session.state !== "RUNNING" || !session.pendingRequest ||
          !safeEqual(requestId, session.pendingRequest.requestId)) {
        return { ok: false, reason: "request_binding_mismatch" };
      }
      if (now() >= session.pendingRequest.deadline) {
        emit(session, "request.timed_out", { request_id: requestId, method: session.pendingRequest.method });
        session.pendingRequest = null;
        transition(session, "QUARANTINED", "request_deadline_exceeded");
        return { ok: false, reason: "request_timed_out" };
      }
      if (!["completed", "rejected", "failed"].includes(outcome)) return { ok: false, reason: "invalid_request_outcome" };
      const pending = session.pendingRequest;
      session.pendingRequest = null;
      emit(session, outcome === "completed" ? "request.completed" : "request.rejected", {
        request_id: requestId, method: pending.method, result_code: String(resultCode).slice(0, 64)
      });
      transition(session, "READY");
      return { ok: true, state: session.state };
    },

    cancel(sessionId, identity, reason = "owner_cancelled") {
      const found = getOwned(sessionId, identity);
      if (found.error) return { ok: false, reason: found.error };
      const session = found.session;
      if (TERMINAL.has(session.state)) return { ok: false, reason: "session_terminal" };
      if (!TRANSITIONS[session.state]?.has("CANCELLED")) return { ok: false, reason: "session_cannot_be_cancelled" };
      session.pendingRequest = null;
      transition(session, "CANCELLED", reason);
      emit(session, "session.cancelled", { reason_code: reason });
      return { ok: true, state: session.state, runtimeMustBeTerminated: Boolean(session.runtimeInstanceId) };
    },

    quarantine(sessionId, identity, reason = "runtime_integrity_failure") {
      const found = getOwned(sessionId, identity);
      if (found.error) return { ok: false, reason: found.error };
      const session = found.session;
      if (!["STARTING", "READY", "RUNNING", "CLOSING"].includes(session.state)) {
        return { ok: false, reason: "session_not_quarantinable" };
      }
      session.pendingRequest = null;
      const result = transition(session, "QUARANTINED", reason);
      if (result.ok) emit(session, "session.quarantined", { reason_code: reason });
      return result;
    },

    beginClose(sessionId, identity) {
      const found = getOwned(sessionId, identity);
      if (found.error) return { ok: false, reason: found.error };
      const session = found.session;
      if (expireIfNeeded(session)) return { ok: false, reason: "session_expired" };
      if (!["READY", "RUNNING"].includes(session.state)) return { ok: false, reason: "session_not_closable" };
      session.pendingRequest = null;
      return transition(session, "CLOSING", "close_requested");
    },

    finishClose(sessionId, identity, { processTreeTerminated, profileDestroyed, ipcClosed } = {}) {
      const found = getOwned(sessionId, identity);
      if (found.error) return { ok: false, reason: found.error };
      const session = found.session;
      if (session.state !== "CLOSING") return { ok: false, reason: "session_not_closing" };
      if (processTreeTerminated !== true || profileDestroyed !== true || ipcClosed !== true) {
        transition(session, "QUARANTINED", "cleanup_not_confirmed");
        emit(session, "session.quarantined", { cleanup_status: "incomplete" });
        return { ok: false, reason: "cleanup_not_confirmed", state: session.state };
      }
      emit(session, "runtime.terminated");
      emit(session, "profile.destroyed");
      session.runtimeInstanceId = null;
      transition(session, "CLOSED", "cleanup_confirmed");
      emit(session, "session.closed", { cleanup_status: "complete" });
      return { ok: true, state: session.state };
    },

    get(sessionId, identity) {
      const found = getOwned(sessionId, identity);
      if (found.error) return { ok: false, reason: found.error };
      if (expireIfNeeded(found.session)) return { ok: false, reason: "session_expired" };
      return { ok: true, session: snapshot(found.session) };
    }
  });
}
