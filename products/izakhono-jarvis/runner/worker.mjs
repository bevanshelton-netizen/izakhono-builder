// J.A.R.V.I.S. external worker bridge.
// One bounded claim per invocation. Completion remains subject to owner verification.
const DEFAULT_AGENT = "coordinator";
const MAX_RESPONSE_CHARS = 4000;
const MAX_EVIDENCE_CHARS = 2000;
const CLAIM_TIMEOUT_MS = 15000;
const EXECUTION_TIMEOUT_MS = 60000;

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(name + " is required");
  return value.trim();
}

function safeText(value, max = 1000) {
  return String(value ?? "Worker adapter failed").replace(/[\r\n\t]+/g, " ").slice(0, max);
}

function endpoint(value, name) {
  const parsed = new URL(required(value, name));
  if (parsed.protocol !== "https:") throw new Error("J.A.R.V.I.S. worker endpoints must use HTTPS");
  if (parsed.username || parsed.password) throw new Error("Credentials must not be embedded in endpoint URLs");
  if (parsed.search || parsed.hash) throw new Error("Worker endpoint URLs must not contain query strings or fragments");
  if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".localhost") || parsed.hostname === "0.0.0.0" || parsed.hostname === "::1") {
    throw new Error("Local worker endpoints are not permitted");
  }
  return parsed;
}

function assertAllowedExecutor(adapter, env) {
  const configured = required(env.JARVIS_EXECUTOR_ALLOWED_HOSTS, "JARVIS_EXECUTOR_ALLOWED_HOSTS");
  const allowed = configured.split(",").map(host => host.trim().toLowerCase()).filter(Boolean);
  if (allowed.length === 0) throw new Error("JARVIS_EXECUTOR_ALLOWED_HOSTS must contain at least one hostname");
  if (!allowed.includes(adapter.hostname.toLowerCase())) {
    throw new Error("Executor host is not in JARVIS_EXECUTOR_ALLOWED_HOSTS");
  }
}

async function readBoundedText(response, maxChars) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxChars * 4) {
    try { await response.body?.cancel?.(); } catch {}
    throw new Error("Worker endpoint response exceeded the size limit");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length > maxChars) {
        try { await reader.cancel(); } catch {}
        throw new Error("Worker endpoint response exceeded the size limit");
      }
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock?.();
  }
  if (text.length > maxChars) throw new Error("Worker endpoint response exceeded the size limit");
  return text;
}

async function requestJson(fetcher, url, options, timeoutMs = CLAIM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...options, redirect: "error", signal: controller.signal });
    const raw = await readBoundedText(response, MAX_RESPONSE_CHARS);
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error("Worker endpoint returned invalid JSON"); }
    if (!response.ok) throw new Error("Worker endpoint returned HTTP " + response.status);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function validStep(step, agentId) {
  return Boolean(
    step &&
    typeof step.id === "string" &&
    step.id.trim() &&
    step.id.length <= 200 &&
    step.assigned_agent === agentId
  );
}

export async function runJarvisWorkerOnce(env = process.env, fetcher = fetch) {
  const base = endpoint(env.JARVIS_API_BASE_URL, "JARVIS_API_BASE_URL");
  const secret = required(env.JARVIS_OWNER_SECRET, "JARVIS_OWNER_SECRET");
  const adapter = endpoint(env.JARVIS_EXECUTOR_URL, "JARVIS_EXECUTOR_URL");
  const adapterToken = required(env.JARVIS_EXECUTOR_TOKEN, "JARVIS_EXECUTOR_TOKEN");
  assertAllowedExecutor(adapter, env);

  const agentId = required(env.JARVIS_AGENT_ID || DEFAULT_AGENT, "JARVIS_AGENT_ID");
  if (agentId.length > 128) throw new Error("JARVIS_AGENT_ID exceeds the size limit");
  const baseUrl = base.toString().replace(/\/+$/, "");
  const ownerHeaders = { "content-type": "application/json", "x-admin-secret": secret };
  const claim = await requestJson(fetcher, baseUrl + "/api/jarvis/workforce/claim", {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({ agent_id: agentId }),
  });
  if (!claim || claim.ok !== true) throw new Error("J.A.R.V.I.S. claim request was rejected");
  if (claim.claimed === false) return { status: "idle", claimed: false };
  if (claim.claimed !== true) throw new Error("J.A.R.V.I.S. claim response failed validation");

  const step = claim.step;
  const stepId = typeof step?.id === "string" && step.id.trim() ? step.id.trim() : null;
  try {
    if (!validStep(step, agentId)) throw new Error("Claim response failed agent or task validation");
    const result = await requestJson(fetcher, adapter.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + adapterToken,
        "idempotency-key": "jarvis-step-" + step.id,
      },
      body: JSON.stringify({
        contract: "izakhono.jarvis.executor/v1",
        idempotency_key: "jarvis-step-" + step.id,
        step: {
          id: step.id,
          title: safeText(step.title, 300),
          description: safeText(step.description, 2000),
          agent_id: agentId,
        },
      }),
    }, EXECUTION_TIMEOUT_MS);

    if (
      result?.status !== "completed" ||
      typeof result.evidence !== "string" ||
      result.evidence.trim().length < 8 ||
      result.evidence.length > MAX_EVIDENCE_CHARS
    ) {
      throw new Error("Executor must return status=completed and 8–2000 characters of evidence");
    }

    const completed = await requestJson(fetcher, baseUrl + "/api/jarvis/workforce/steps/" + encodeURIComponent(step.id) + "/complete", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ agent_id: agentId, evidence: result.evidence.trim() }),
    });
    if (completed?.ok !== true) throw new Error("J.A.R.V.I.S. rejected completion evidence");
    return { status: "completed", claimed: true, step_id: step.id, owner_verification: "pending" };
  } catch (error) {
    const message = safeText(error instanceof Error ? error.message : error);
    if (stepId) {
      try {
        await requestJson(fetcher, baseUrl + "/api/jarvis/workforce/steps/" + encodeURIComponent(stepId) + "/fail", {
          method: "POST",
          headers: ownerHeaders,
          body: JSON.stringify({ agent_id: agentId, error: message }),
        });
      } catch {
        // The queue's lease expiry remains the recovery path if failure reporting is unavailable.
      }
    }
    return { status: "failed", claimed: true, ...(stepId ? { step_id: stepId } : {}), error: message };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runJarvisWorkerOnce().then(result => {
    process.stdout.write(JSON.stringify(result) + "\n");
    if (result.status === "failed") process.exitCode = 1;
  }).catch(error => {
    process.stderr.write(safeText(error instanceof Error ? error.message : error) + "\n");
    process.exitCode = 1;
  });
}
