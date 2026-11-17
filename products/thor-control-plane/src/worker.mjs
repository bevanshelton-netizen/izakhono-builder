/**
 * THOR Control Plane HTTP API.
 *
 * This API manages durable task state only. It never executes repository code.
 * API and worker credentials are supplied as SHA-256 hashes so raw tokens are
 * not stored in Worker variables. Coding execution remains a separate sandbox.
 */
import { D1ThorStore } from "./d1-store.mjs";
import { ThorError, ThorOrchestrator } from "./index.mjs";
import { validateWorkerEnvelope, validateWorkerResult } from "./worker-contract.mjs";

const MAX_BODY_BYTES = 64 * 1024;
const MIN_LEASE_MS = 1_000;
const MAX_LEASE_MS = 15 * 60 * 1_000;
const SAFE_WORKER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const HASH = /^[a-f0-9]{64}$/i;
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: HEADERS });
}

function tokenFrom(request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function workerTokenHashes(env) {
  try {
    const value = JSON.parse(env.THOR_WORKER_TOKEN_HASHES || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value)
      .filter(([workerId, hash]) => SAFE_WORKER_ID.test(workerId) && typeof hash === "string" && HASH.test(hash)));
  } catch {
    return {};
  }
}

async function authorized(request, expectedHash) {
  if (!HASH.test(expectedHash || "")) return false;
  const token = tokenFrom(request);
  if (!token || token.length > 512) return false;
  return constantTimeEqual(await sha256(token), expectedHash.toLowerCase());
}

async function workerAuthorized(request, env, workerId) {
  if (!SAFE_WORKER_ID.test(workerId || "")) return false;
  const expected = workerTokenHashes(env)[workerId];
  return authorized(request, expected);
}

async function readJson(request) {
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ThorError("Content-Type must be application/json", "INVALID_CONTENT_TYPE");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new ThorError("Request body exceeds the 64 KiB limit", "BODY_TOO_LARGE");
  }
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object-required");
    return value;
  } catch {
    throw new ThorError("Request body must be a JSON object", "INVALID_JSON");
  }
}

async function defaultSchemaCheck(db) {
  if (!db?.prepare || typeof db.batch !== "function") return false;
  await db.prepare("SELECT worker_envelope_json FROM thor_tasks LIMIT 0").all();
  await db.prepare("SELECT id FROM thor_task_events LIMIT 0").all();
  return true;
}

function projectPolicies(env) {
  try {
    const value = JSON.parse(env.THOR_PROJECT_POLICIES || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 100) return {};
    return value;
  } catch {
    return {};
  }
}

function validatedProjectPolicies(env) {
  const valid = {};
  for (const [projectId, policy] of Object.entries(projectPolicies(env))) {
    try {
      if (!SAFE_WORKER_ID.test(projectId) || !policy || typeof policy !== "object") continue;
      validateWorkerEnvelope({
        taskId: "policy-check",
        projectId,
        repository: policy.repository,
        baseRef: policy.baseRef,
        workRef: `${policy.workRefPrefix}policy-check`,
        allowedPaths: policy.allowedPaths,
        commands: policy.commands,
        limits: policy.limits,
      });
      if (typeof policy.workRefPrefix !== "string" || !policy.workRefPrefix.endsWith("/")) continue;
      if (policy.maxAttempts != null && (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1 || policy.maxAttempts > 10)) continue;
      valid[projectId] = policy;
    } catch {
      // Invalid project policy is excluded from readiness and task admission.
    }
  }
  return valid;
}

function assertEnvelopeWithinPolicy(envelope, env, taskOptions = {}) {
  const policy = validatedProjectPolicies(env)[envelope.projectId];
  if (!policy) throw new ThorError("Project execution policy is not configured", "PROJECT_POLICY_REQUIRED");
  if (policy.repository !== envelope.repository
    || policy.baseRef !== envelope.baseRef
    || typeof policy.workRefPrefix !== "string"
    || !envelope.workRef.startsWith(policy.workRefPrefix)) {
    throw new ThorError("Task repository or branch exceeds its registered project policy", "PROJECT_SCOPE_VIOLATION");
  }
  if (!Array.isArray(policy.allowedPaths) || !Array.isArray(policy.commands) || !policy.limits) {
    throw new ThorError("Registered project policy is incomplete", "PROJECT_POLICY_REQUIRED");
  }
  for (const requestedPath of envelope.allowedPaths) {
    const allowed = policy.allowedPaths.some(scope => typeof scope === "string"
      && (requestedPath === scope || requestedPath.startsWith(scope.endsWith("/") ? scope : scope + "/")));
    if (!allowed) throw new ThorError("Task path scope exceeds its registered project policy", "PROJECT_SCOPE_VIOLATION");
  }
  for (const command of envelope.commands) {
    if (!policy.commands.includes(command)) throw new ThorError("Task command exceeds its registered project policy", "PROJECT_SCOPE_VIOLATION");
  }
  for (const limit of ["timeoutMs", "maxOutputBytes", "maxChangedFiles", "memoryMb", "cpuCount"]) {
    if (!Number.isInteger(policy.limits[limit]) || envelope.limits[limit] > policy.limits[limit]) {
      throw new ThorError("Task resource limits exceed its registered project policy", "PROJECT_SCOPE_VIOLATION");
    }
  }
  const requestedAttempts = taskOptions.maxAttempts == null ? 3 : taskOptions.maxAttempts;
  if (!Number.isInteger(requestedAttempts) || requestedAttempts < 1 || requestedAttempts > 10
    || (policy.maxAttempts != null && requestedAttempts > policy.maxAttempts)) {
    throw new ThorError("Task retry count exceeds its registered project policy", "PROJECT_SCOPE_VIOLATION");
  }
  return true;
}

function errorStatus(error) {
  const code = error?.code || "INTERNAL_ERROR";
  if (code === "DB_REQUIRED" || code === "PROJECT_POLICY_REQUIRED" || code === "RESULT_VERIFIER_REQUIRED") return 503;
  if (code === "RESULT_VERIFICATION_FAILED") return 409;
  if (code === "PROJECT_SCOPE_VIOLATION") return 403;
  if (code === "BODY_TOO_LARGE") return 413;
  if (code === "TASK_NOT_FOUND") return 404;
  if (code === "TASK_EXISTS" || code === "INVALID_CANCEL" || code === "LEASE_NOT_OWNED" || code === "HEARTBEAT_FAILED") return 409;
  if (code === "UNAUTHORIZED") return 401;
  if (code === "METHOD_NOT_ALLOWED") return 405;
  if (code.startsWith("INVALID_") || code.endsWith("_REQUIRED") || code.endsWith("_NOT_FOUND")
    || code === "DEPENDENCY_NOT_FOUND" || code === "TESTS_NOT_PASSED"
    || code === "PATH_SCOPE_VIOLATION" || code === "SENSITIVE_PATH_CHANGE"
    || code === "CHANGESET_TOO_LARGE" || code === "OUTPUT_LIMIT_EXCEEDED") return 400;
  return 500;
}

function publicError(error) {
  return {
    error: {
      code: error?.code || "INTERNAL_ERROR",
      message: error instanceof ThorError ? error.message.slice(0, 240) : "Internal control-plane error",
    },
  };
}

export function createThorWorker({
  storeFactory = env => new D1ThorStore(env.THOR_DB),
  schemaCheck = defaultSchemaCheck,
  resultVerifier = null,
  clock = () => Date.now(),
} = {}) {
  return {
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      const method = request.method.toUpperCase();
      const pathname = url.pathname;

      if (method === "GET" && pathname === "/health") {
        return json({ service: "thor-control-plane", status: "ok", version: "v1" });
      }

      if (method === "GET" && pathname === "/ready") {
        const checks = {
          databaseConfigured: Boolean(env.THOR_DB?.prepare && typeof env.THOR_DB.batch === "function"),
          apiAuthConfigured: HASH.test(env.THOR_API_TOKEN_SHA256 || ""),
          workerAuthConfigured: Object.keys(workerTokenHashes(env)).length > 0,
          projectPoliciesConfigured: Object.keys(validatedProjectPolicies(env)).length > 0,
          resultVerificationConfigured: typeof resultVerifier === "function",
          schemaReady: false,
        };
        if (checks.databaseConfigured) {
          try { checks.schemaReady = await schemaCheck(env.THOR_DB) === true; } catch { checks.schemaReady = false; }
        }
        const ready = Object.values(checks).every(Boolean);
        return json({ service: "thor-control-plane", status: ready ? "ready" : "waiting", checks }, ready ? 200 : 503);
      }

      if (!env.THOR_DB?.prepare) return json({ error: { code: "DB_REQUIRED", message: "Durable THOR database is not configured" } }, 503);
      if (method !== "GET" && method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);

      try {
        const store = storeFactory(env);
        const configuredLease = Number(env.THOR_LEASE_MS);
        const leaseMs = Number.isInteger(configuredLease) && configuredLease >= MIN_LEASE_MS && configuredLease <= MAX_LEASE_MS
          ? configuredLease : 60_000;
        const thor = new ThorOrchestrator({ store, clock, leaseMs });

        if (method === "GET" && pathname === "/v1/portfolio") {
          if (!await authorized(request, env.THOR_API_TOKEN_SHA256)) throw new ThorError("API authentication required", "UNAUTHORIZED");
          return json(await thor.snapshot());
        }

        if (method === "POST" && pathname === "/v1/tasks") {
          if (!await authorized(request, env.THOR_API_TOKEN_SHA256)) throw new ThorError("API authentication required", "UNAUTHORIZED");
          const body = await readJson(request);
          const envelope = validateWorkerEnvelope(body.workerEnvelope);
          if (envelope.taskId !== body.id || envelope.projectId !== body.projectId) {
            throw new ThorError("Task identity does not match the worker envelope", "INVALID_ENVELOPE");
          }
          assertEnvelopeWithinPolicy(envelope, env, body);
          const task = await thor.submit({ ...body, workerEnvelope: envelope });
          return json({ task }, 201);
        }

        if (method === "POST" && pathname === "/v1/workers/claim") {
          if (typeof resultVerifier !== "function") {
            throw new ThorError("Independent GitHub result verification is not configured", "RESULT_VERIFIER_REQUIRED");
          }
          const body = await readJson(request);
          if (!await workerAuthorized(request, env, body.workerId)) throw new ThorError("Worker authentication required", "UNAUTHORIZED");
          const requestedLease = body.leaseMs == null ? leaseMs : Number(body.leaseMs);
          if (!Number.isInteger(requestedLease) || requestedLease < MIN_LEASE_MS || requestedLease > MAX_LEASE_MS) {
            throw new ThorError("Lease must be between 1 second and 15 minutes", "INVALID_LEASE");
          }
          const task = await store.claimNext(body.workerId, requestedLease, { requireWorkerEnvelope: true });
          return json({ claimed: Boolean(task), task: task || null });
        }

        const taskRoute = pathname.match(/^\/v1\/tasks\/([^/]+)(?:\/(heartbeat|complete|fail|cancel))?$/);
        if (taskRoute) {
          const taskId = decodeURIComponent(taskRoute[1]);
          const operation = taskRoute[2] || "get";

          if (method === "GET" && operation === "get") {
            if (!await authorized(request, env.THOR_API_TOKEN_SHA256)) throw new ThorError("API authentication required", "UNAUTHORIZED");
            const task = await store.getTask(taskId);
            if (!task) throw new ThorError("Task not found", "TASK_NOT_FOUND");
            return json({ task });
          }

          if (method !== "POST") throw new ThorError("Method not allowed", "METHOD_NOT_ALLOWED");
          if (operation === "cancel") {
            if (!await authorized(request, env.THOR_API_TOKEN_SHA256)) throw new ThorError("API authentication required", "UNAUTHORIZED");
            return json({ task: await store.cancel(taskId) });
          }

          const body = await readJson(request);
          if (!await workerAuthorized(request, env, body.workerId)) throw new ThorError("Worker authentication required", "UNAUTHORIZED");

          if (operation === "heartbeat") {
            const requestedLease = body.leaseMs == null ? leaseMs : Number(body.leaseMs);
            if (!Number.isInteger(requestedLease) || requestedLease < MIN_LEASE_MS || requestedLease > MAX_LEASE_MS) {
              throw new ThorError("Lease must be between 1 second and 15 minutes", "INVALID_LEASE");
            }
            const renewed = await store.heartbeat(taskId, body.workerId, requestedLease);
            if (!renewed) throw new ThorError("Worker lease is no longer active", "LEASE_NOT_OWNED");
            return json({ taskId, heartbeat: "renewed" });
          }

          if (operation === "complete") {
            const task = await store.getTask(taskId);
            if (!task) throw new ThorError("Task not found", "TASK_NOT_FOUND");
            if (!task.workerEnvelope) throw new ThorError("Task has no validated worker envelope", "INVALID_ENVELOPE");
            const result = validateWorkerResult(body.result, task.workerEnvelope);
            if (typeof resultVerifier !== "function") {
              throw new ThorError("Independent GitHub result verification is not configured", "RESULT_VERIFIER_REQUIRED");
            }
            const independentlyVerified = await resultVerifier({ task, result, env });
            if (independentlyVerified !== true) {
              throw new ThorError("GitHub commit and pull request could not be independently verified", "RESULT_VERIFICATION_FAILED");
            }
            return json({ task: await store.finish(taskId, body.workerId, result) });
          }

          if (operation === "fail") {
            if (typeof body.error !== "string" || !body.error.trim() || body.error.length > 2_000) {
              throw new ThorError("A bounded failure reason is required", "INVALID_RESULT");
            }
            return json({ task: await store.fail(taskId, body.workerId, new Error(body.error)) });
          }
        }

        return json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404);
      } catch (error) {
        return json(publicError(error), errorStatus(error));
      }
    },
  };
}

const thorWorker = createThorWorker();
export default { fetch: (request, env) => thorWorker.fetch(request, env) };
