import { randomUUID } from "node:crypto";
import { authenticateDeploymentRequest } from "./authorization.mjs";
import { transitionDeploymentAtomically } from "./transaction.mjs";
import { createPostgresTransactionRunner } from "./postgres-adapter.mjs";

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, max-age=0",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...extraHeaders
  }
});
const validId = value => typeof value === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

async function readJsonLimited(request, maxBytes) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function errorStatus(code) {
  if (["AUTH_CONFIG_INVALID", "SESSION_VERIFICATION_UNAVAILABLE", "TRANSACTION_RUNNER_REQUIRED",
       "TRANSACTION_ADAPTER_INVALID", "IDEMPOTENCY_ADAPTER_INVALID", "IDEMPOTENCY_CLAIM_INVALID",
       "CALLBACK_REQUIRED", "POOL_REQUIRED", "DEPLOYMENT_WRITE_CONFLICT",
       "IDEMPOTENCY_WRITE_CONFLICT"].includes(code) || /^[0-9A-Z]{5}$/.test(code)) return 503;
  if (["AUTHENTICATION_REQUIRED", "TOKEN_INVALID", "TOKEN_CLAIMS_INVALID",
       "SESSION_INVALID", "SESSION_VERIFICATION_UNAVAILABLE"].includes(code)) return 401;
  if (["TENANT_FORBIDDEN", "APPLICATION_FORBIDDEN", "ENVIRONMENT_FORBIDDEN",
       "SCOPE_FORBIDDEN", "PRINCIPAL_UNTRUSTED", "PRINCIPAL_EXPIRED"].includes(code)) return 403;
  if (code === "DEPLOYMENT_NOT_FOUND") return 404;
  if (["IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_REPLAY_INVALID", "INVALID_TRANSITION",
       "DEPLOYMENT_SCOPE_MISMATCH", "IDEMPOTENCY_CLAIM_MISMATCH"].includes(code)) return 409;
  if (code && (code.endsWith("_REQUIRED") || code.endsWith("_INVALID") ||
       code.endsWith("_REJECTED") || code.endsWith("_MISMATCH") ||
       code === "EVIDENCE_NOT_JSON" || code === "SECRET_EVIDENCE_REJECTED")) return 400;
  return 500;
}

function safeError(error, requestId) {
  const code = typeof error?.code === "string" ? error.code : "INTERNAL_ERROR";
  const status = errorStatus(code);
  const message = status >= 500
    ? "The deployment service could not complete the request."
    : (typeof error?.message === "string" ? error.message : "The deployment request was rejected.");
  return json({ error: code, message, request_id: requestId }, status);
}

/**
 * Create the owned-host DEPLOY HTTP handler. The PostgreSQL pool and FORTRESS
 * verifier are injected; no database, identity secret or migration is created
 * implicitly by this module.
 */
export function createDeployApiHandler({
  pool,
  verifyAccessToken,
  verifyActiveSession,
  issuer,
  audience = "izakhono-deploy",
  clock = () => new Date(),
  maxBodyBytes = 64 * 1024
} = {}) {
  const withTransaction = createPostgresTransactionRunner(pool);
  if (typeof verifyAccessToken !== "function" || typeof issuer !== "string" || !issuer.trim() ||
      typeof audience !== "string" || !audience.trim() ||
      !Number.isInteger(maxBodyBytes) || maxBodyBytes < 1024 || maxBodyBytes > 256 * 1024) {
    throw new TypeError("DEPLOY API identity and request configuration is invalid.");
  }

  return async function handleDeployApi(request) {
    const requestId = randomUUID();
    let url;
    try { url = new URL(request.url); }
    catch { return json({ error: "REQUEST_URL_INVALID", request_id: requestId }, 400); }

    if (url.pathname === "/healthz") {
      if (request.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED", request_id: requestId }, 405, { allow: "GET" });
      return json({ service: "IZAKHONO DEPLOY", status: "alive", request_id: requestId });
    }

    const match = url.pathname.match(
      /^\/api\/tenants\/([^/]+)\/applications\/([^/]+)\/environments\/([^/]+)\/deployments\/([^/]+)\/transitions$/
    );
    if (!match) return json({ error: "NOT_FOUND", request_id: requestId }, 404);
    if (request.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED", request_id: requestId }, 405, { allow: "POST" });
    }
    const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (contentType !== "application/json") {
      return json({ error: "CONTENT_TYPE_REQUIRED", request_id: requestId }, 415);
    }

    let resource;
    let deploymentId;
    try {
      const [tenantId, applicationId, environmentId, id] = match.slice(1).map(decodeURIComponent);
      if (![tenantId, applicationId, environmentId, id].every(validId)) {
        return json({ error: "RESOURCE_ID_INVALID", request_id: requestId }, 400);
      }
      resource = { tenantId, applicationId, environmentId };
      deploymentId = id;
    } catch {
      return json({ error: "RESOURCE_ID_INVALID", request_id: requestId }, 400);
    }

    const idempotencyKey = request.headers.get("idempotency-key") || "";
    if (!/^[A-Za-z0-9._:-]{8,256}$/.test(idempotencyKey)) {
      return json({ error: "IDEMPOTENCY_KEY_REQUIRED", request_id: requestId }, 400);
    }
    let body;
    try { body = await readJsonLimited(request, maxBodyBytes); }
    catch { return json({ error: "TRANSITION_BODY_INVALID", request_id: requestId }, 400); }
    if (!body || Object.keys(body).some(key => !["nextState", "evidence"].includes(key)) ||
        typeof body.nextState !== "string" ||
        !body.evidence || typeof body.evidence !== "object" || Array.isArray(body.evidence)) {
      return json({ error: "TRANSITION_BODY_INVALID", request_id: requestId }, 400);
    }

    const timestamp = clock();
    const nowDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (!Number.isFinite(nowDate.getTime())) {
      return json({ error: "CLOCK_INVALID", request_id: requestId }, 503);
    }

    let principal;
    try {
      principal = await authenticateDeploymentRequest({
        authorization: request.headers.get("authorization"),
        verifyAccessToken,
        verifyActiveSession,
        issuer,
        audience,
        now: nowDate.getTime()
      });
    } catch (error) {
      return safeError(error, requestId);
    }

    try {
      const result = await transitionDeploymentAtomically({
        principal,
        resource,
        deploymentId,
        idempotencyKey,
        nextState: body.nextState,
        evidence: body.evidence,
        withTransaction,
        now: () => nowDate
      });
      return json({ ...result, request_id: requestId }, 200);
    } catch (error) {
      return safeError(error, requestId);
    }
  };
}
