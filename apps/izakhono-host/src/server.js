import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.env.PORT || 8788);
const dataDir = process.env.IZAKHONO_HOST_DATA || path.join(process.cwd(), ".data");
const stateFile = path.join(dataDir, "state.json");
const adminToken = process.env.IZAKHONO_HOST_ADMIN_TOKEN || "";
const maxBodyBytes = 1024 * 1024;

const service = {
  name: "IZAKHONO HOST",
  engine: "izakhono-host",
  version: "0.2.0",
  owned_first: true,
  public_live: false,
  capabilities: [
    "tenant-control-plane", "projects", "deployments", "preview-environments",
    "custom-domains", "environment-variables", "build-jobs", "deployment-logs",
    "web-hosting", "business-email", "dns", "tls", "databases", "backups",
    "monitoring", "reseller-hosting", "registrar-adapters"
  ]
};

function initialState() {
  return { schema: "izakhono.host/state/v1", tenants: {}, projects: {}, deployments: {}, events: [] };
}

function loadState() {
  fs.mkdirSync(dataDir, { recursive: true });
  try { return JSON.parse(fs.readFileSync(stateFile, "utf8")); }
  catch { const state = initialState(); saveState(state); return state; }
}

function saveState(state) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${stateFile}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, stateFile);
}

let state = loadState();

function id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function now() { return new Date().toISOString(); }
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
function authorized(req) {
  if (!adminToken) return process.env.NODE_ENV !== "production";
  return req.headers.authorization === `Bearer ${adminToken}`;
}
function record(type, subject, detail = {}) {
  state.events.push({ id: id("evt"), type, subject, detail, at: now() });
  if (state.events.length > 2000) state.events = state.events.slice(-2000);
}
async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function route(req) {
  const url = new URL(req.url, "http://localhost");
  return { pathname: url.pathname, query: url.searchParams };
}

const server = http.createServer(async (req, res) => {
  const { pathname } = route(req);
  try {
    if (req.method === "GET" && pathname === "/health") return json(res, 200, { ok: true, ...service, persistence: "file-backed" });
    if (req.method === "GET" && pathname === "/api/v1/capabilities") return json(res, 200, service);
    if (req.method === "GET" && pathname === "/api/v1/metrics") return json(res, 200, {
      tenants: Object.keys(state.tenants).length,
      projects: Object.keys(state.projects).length,
      deployments: Object.keys(state.deployments).length,
      events: state.events.length
    });
    if (!authorized(req)) return json(res, 401, { error: "unauthorized" });

    if (req.method === "POST" && pathname === "/api/v1/tenants") {
      const input = await body(req);
      if (!input.name) return json(res, 400, { error: "name_required" });
      const tenant = { id: id("ten"), name: String(input.name), slug: String(input.slug || input.name).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""), quota: { projects: 20, deployments_per_day: 200, storage_mb: 10240 }, created_at: now() };
      state.tenants[tenant.id] = tenant; record("tenant.created", tenant.id, { name: tenant.name }); saveState(state);
      return json(res, 201, tenant);
    }

    if (req.method === "POST" && pathname === "/api/v1/projects") {
      const input = await body(req);
      if (!input.tenant_id || !state.tenants[input.tenant_id]) return json(res, 400, { error: "valid_tenant_id_required" });
      if (!input.name) return json(res, 400, { error: "name_required" });
      const count = Object.values(state.projects).filter(p => p.tenant_id === input.tenant_id).length;
      if (count >= state.tenants[input.tenant_id].quota.projects) return json(res, 429, { error: "project_quota_exceeded" });
      const project = { id: id("prj"), tenant_id: input.tenant_id, name: String(input.name), slug: String(input.slug || input.name).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""), framework: input.framework || "node", domains: [], env: {}, created_at: now(), updated_at: now() };
      state.projects[project.id] = project; record("project.created", project.id, { tenant_id: project.tenant_id }); saveState(state);
      return json(res, 201, project);
    }

    const projectEnv = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/env$/);
    if (req.method === "PUT" && projectEnv) {
      const project = state.projects[projectEnv[1]];
      if (!project) return json(res, 404, { error: "project_not_found" });
      const input = await body(req);
      if (!input.name || typeof input.value !== "string") return json(res, 400, { error: "name_and_value_required" });
      project.env[String(input.name)] = { value: input.value, secret: Boolean(input.secret), updated_at: now() };
      project.updated_at = now(); record("project.env.updated", project.id, { name: input.name, secret: Boolean(input.secret) }); saveState(state);
      return json(res, 200, { ok: true, name: input.name, secret: Boolean(input.secret) });
    }

    const projectDomain = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/domains$/);
    if (req.method === "POST" && projectDomain) {
      const project = state.projects[projectDomain[1]];
      if (!project) return json(res, 404, { error: "project_not_found" });
      const input = await body(req);
      if (!input.hostname) return json(res, 400, { error: "hostname_required" });
      const hostname = String(input.hostname).toLowerCase().trim();
      if (!/^[a-z0-9.-]+$/.test(hostname) || hostname.startsWith(".") || hostname.endsWith(".")) return json(res, 400, { error: "invalid_hostname" });
      const domain = { hostname, status: "pending", verification: { type: "IZAKHONO_HOST", token: crypto.randomBytes(16).toString("hex") }, added_at: now() };
      project.domains.push(domain); project.updated_at = now(); record("domain.attached", project.id, { hostname }); saveState(state);
      return json(res, 201, domain);
    }

    if (req.method === "POST" && pathname === "/api/v1/deployments") {
      const input = await body(req);
      const project = state.projects[input.project_id];
      if (!project) return json(res, 404, { error: "project_not_found" });
      const deployment = {
        id: id("dep"), project_id: project.id, tenant_id: project.tenant_id,
        source: { provider: input.provider || "git", repository: input.repository || null, commit: input.commit || null },
        state: "queued", url: null, logs: [{ at: now(), level: "info", message: "Deployment accepted by IZAKHONO HOST control plane" }],
        created_at: now(), updated_at: now()
      };
      state.deployments[deployment.id] = deployment; record("deployment.queued", deployment.id, { project_id: project.id }); saveState(state);
      return json(res, 202, deployment);
    }

    const deploymentMatch = pathname.match(/^\/api\/v1\/deployments\/([^/]+)$/);
    if (req.method === "GET" && deploymentMatch) {
      const deployment = state.deployments[deploymentMatch[1]];
      if (!deployment) return json(res, 404, { error: "deployment_not_found" });
      return json(res, 200, deployment);
    }

    if (req.method === "GET" && pathname === "/api/v1/events") return json(res, 200, { events: state.events.slice(-100) });
    return json(res, 404, { error: "not_found" });
  } catch (error) {
    if (error?.message === "body_too_large") return json(res, 413, { error: "body_too_large" });
    if (error instanceof SyntaxError) return json(res, 400, { error: "invalid_json" });
    console.error(error);
    return json(res, 500, { error: "internal_error" });
  }
});

server.listen(port, "0.0.0.0", () => console.log(`IZAKHONO HOST engine listening on ${port}`));
