// J.A.R.V.I.S. external worker bridge. One bounded claim per invocation; disabled until credentials and an adapter are configured.
const DEFAULT_AGENT = "coordinator";
const MAX_RESPONSE_CHARS = 4000;
function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(name + " is required");
  return value.trim();
}
function safeText(value, max = 1000) {
  return String(value ?? "Worker adapter failed").replace(/[\r\n\t]+/g, " ").slice(0, max);
}
async function requestJson(fetcher, url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    if (raw.length > MAX_RESPONSE_CHARS) throw new Error("Worker endpoint response exceeded the size limit");
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error("Worker endpoint returned invalid JSON"); }
    if (!response.ok) throw new Error("Worker endpoint returned HTTP " + response.status);
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export async function runJarvisWorkerOnce(env = process.env, fetcher = fetch) {
  const base = required(env.JARVIS_API_BASE_URL, "JARVIS_API_BASE_URL").replace(/\/+$/, "");
  const secret = required(env.JARVIS_OWNER_SECRET, "JARVIS_OWNER_SECRET");
  const adapterBase = required(env.JARVIS_EXECUTOR_URL, "JARVIS_EXECUTOR_URL");
  const adapterToken = required(env.JARVIS_EXECUTOR_TOKEN, "JARVIS_EXECUTOR_TOKEN");
  const api = new URL(base);
  const adapter = new URL(adapterBase);
  if (api.protocol !== "https:" || adapter.protocol !== "https:") throw new Error("J.A.R.V.I.S. worker endpoints must use HTTPS");
  if (api.username || api.password || adapter.username || adapter.password) throw new Error("Credentials must not be embedded in endpoint URLs");
  const agentId = env.JARVIS_AGENT_ID || DEFAULT_AGENT;
  const ownerHeaders = { "content-type": "application/json", "x-admin-secret": secret };
  const claim = await requestJson(fetcher, base + "/api/jarvis/workforce/claim", {
    method: "POST", headers: ownerHeaders, body: JSON.stringify({ agent_id: agentId }),
  });
  if (!claim.ok) throw new Error("J.A.R.V.I.S. claim request was rejected");
  if (!claim.claimed) return { status: "idle", claimed: false };
  const step = claim.step;
  if (!step || typeof step.id !== "string" || step.assigned_agent !== agentId) throw new Error("Claim response failed validation");
  try {
    const result = await requestJson(fetcher, adapter.toString(), {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + adapterToken },
      body: JSON.stringify({
        contract: "izakhono.jarvis.executor/v1",
        step: { id: step.id, title: step.title, description: step.description, agent_id: agentId },
      }),
    }, 60000);
    if (result.status !== "completed" || typeof result.evidence !== "string" || result.evidence.trim().length < 8 || result.evidence.length > 2000) {
      throw new Error("Executor must return status=completed and 8–2000 characters of evidence");
    }
    const completed = await requestJson(fetcher, base + "/api/jarvis/workforce/steps/" + encodeURIComponent(step.id) + "/complete", {
      method: "POST", headers: ownerHeaders, body: JSON.stringify({ agent_id: agentId, evidence: result.evidence.trim() }),
    });
    if (!completed.ok) throw new Error("J.A.R.V.I.S. rejected completion evidence");
    return { status: "completed", claimed: true, step_id: step.id, owner_verification: "pending" };
  } catch (error) {
    const message = safeText(error instanceof Error ? error.message : error);
    try {
      await requestJson(fetcher, base + "/api/jarvis/workforce/steps/" + encodeURIComponent(step.id) + "/fail", {
        method: "POST", headers: ownerHeaders, body: JSON.stringify({ agent_id: agentId, error: message }),
      });
    } catch {
      // The five-minute lease expiry is the recovery path if failure reporting is unavailable.
    }
    return { status: "failed", claimed: true, step_id: step.id, error: message };
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
