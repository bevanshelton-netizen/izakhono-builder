const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { selectNode } = require("./engine/scheduler");

const PORT = Number(process.env.PORT || 8080);
const publicDir = path.join(__dirname, "public");

const state = {
  images: [
    { name: "izakhono/allegro-web", tag: "latest", size: "186 MB", scan: "clean", updated: "2 min ago" },
    { name: "izakhono/kora-network", tag: "prod", size: "214 MB", scan: "clean", updated: "18 min ago" },
    { name: "izakhono/faisready", tag: "2026.09", size: "142 MB", scan: "clean", updated: "1 hr ago" }
  ],
  builds: [
    { id: "BLD-1042", project: "allegro-web", status: "passed", duration: "1m 18s", commit: "b7baf0a" },
    { id: "BLD-1041", project: "kora-network", status: "passed", duration: "58s", commit: "85c3813" },
    { id: "BLD-1040", project: "faisready", status: "passed", duration: "1m 42s", commit: "main" }
  ],
  nodes: [
    { name: "ISN-01", region: "Johannesburg", status: "online", cpu: 31, memory: 47, workloads: 7 },
    { name: "ISN-EDGE-01", region: "Roodepoort", status: "online", cpu: 18, memory: 39, workloads: 4 }
  ],
  workloads: [],
  deployments: [
    { app: "Allegro", image: "izakhono/allegro-web:latest", node: "ISN-01", status: "running", url: "https://allegro.izakhono.local" },
    { app: "KORA", image: "izakhono/kora-network:prod", node: "ISN-EDGE-01", status: "running", url: "https://kora.izakhono.local" }
  ]
};

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
    "Cache-Control": "no-store"
  });
  res.end(data);
}

function serveStatic(req, res) {
  let requestPath = req.url.split("?")[0];
  if (requestPath === "/") requestPath = "/index.html";
  const filePath = path.normalize(path.join(publicDir, requestPath));
  if (!filePath.startsWith(publicDir)) return json(res, 403, { error: "forbidden" });
  fs.readFile(filePath, (err, data) => {
    if (err) return json(res, 404, { error: "not_found" });
    const ext = path.extname(filePath);
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png"
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

function collect(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => {
      body += c;
      if (body.length > 1_000_000) reject(new Error("payload_too_large"));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("invalid_json")); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, service: "izakhono-containers", version: "0.1.0", runtime: "OCI-ready" });
  }
  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    return json(res, 200, {
      stats: {
        repositories: state.images.length,
        activeDeployments: state.deployments.filter(x => x.status === "running").length,
        healthyNodes: state.nodes.filter(x => x.status === "online").length,
        criticalVulnerabilities: 0
      },
      images: state.images,
      builds: state.builds,
      nodes: state.nodes,
      deployments: state.deployments
    });
  }
  if (req.method === "GET" && url.pathname === "/api/images") return json(res, 200, state.images);
  if (req.method === "GET" && url.pathname === "/api/builds") return json(res, 200, state.builds);
  if (req.method === "GET" && url.pathname === "/api/nodes") return json(res, 200, state.nodes);
  if (req.method === "GET" && url.pathname === "/api/deployments") return json(res, 200, state.deployments);

  const nodeToken = req.headers["x-iz-node-token"];
  const expectedNodeToken = process.env.IZ_NODE_ENROLL_TOKEN || "dev-only-change-me";
  const engineAuth = () => nodeToken && nodeToken === expectedNodeToken;

  if (req.method === "POST" && url.pathname === "/api/engine/nodes/register") {
    if (!engineAuth()) return json(res, 401, { error: "invalid_node_token" });
    try {
      const body = await collect(req);
      if (!body.name) return json(res, 400, { error: "node_name_required" });
      let node = state.nodes.find(n => n.name === body.name);
      if (!node) {
        node = { name: body.name, region: body.region || "unknown", status: "online", cpu: 0, memory: 0, workloads: 0 };
        state.nodes.push(node);
      }
      node.status = "online";
      node.region = body.region || node.region;
      node.lastSeen = new Date().toISOString();
      return json(res, 200, { ok: true, node });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }

  if (req.method === "POST" && url.pathname === "/api/engine/nodes/heartbeat") {
    if (!engineAuth()) return json(res, 401, { error: "invalid_node_token" });
    try {
      const body = await collect(req);
      const node = state.nodes.find(n => n.name === body.name);
      if (!node) return json(res, 404, { error: "node_not_registered" });
      node.status = "online";
      node.region = body.region || node.region;
      node.cpu = Number(body.cpu || 0);
      node.memory = Number(body.memory || 0);
      node.workloads = Number(body.workloads || 0);
      node.lastSeen = new Date().toISOString();
      return json(res, 200, { ok: true, node });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }

  if (req.method === "GET" && url.pathname === "/api/engine/workloads/next") {
    if (!engineAuth()) return json(res, 401, { error: "invalid_node_token" });
    const nodeName = url.searchParams.get("node");
    const workload = state.workloads.find(w => w.node === nodeName && w.status === "queued") || null;
    if (workload) {
      workload.status = "claimed";
      workload.claimedAt = new Date().toISOString();
    }
    return json(res, 200, { workload });
  }

  if (req.method === "POST" && /^\/api\/engine\/workloads\/[^/]+\/status$/.test(url.pathname)) {
    if (!engineAuth()) return json(res, 401, { error: "invalid_node_token" });
    try {
      const id = url.pathname.split("/")[4];
      const body = await collect(req);
      const workload = state.workloads.find(w => w.id === id);
      if (!workload) return json(res, 404, { error: "workload_not_found" });
      workload.status = body.status || workload.status;
      workload.containerId = body.containerId || workload.containerId;
      workload.containerName = body.containerName || workload.containerName;
      workload.error = body.error || null;
      workload.updatedAt = new Date().toISOString();
      const deployment = state.deployments.find(d => d.id === workload.deploymentId);
      if (deployment) deployment.status = workload.status;
      return json(res, 200, { ok: true, workload });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }

  if (req.method === "POST" && url.pathname === "/api/builds") {
    try {
      const body = await collect(req);
      const build = {
        id: "BLD-" + Math.floor(1000 + Math.random() * 9000),
        project: body.project || "new-project",
        status: "queued",
        duration: "—",
        commit: body.commit || "main"
      };
      state.builds.unshift(build);
      return json(res, 202, { message: "Build accepted by IZAKHONO Build Cloud", build });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }

  if (req.method === "POST" && url.pathname === "/api/deployments") {
    try {
      const body = await collect(req);
      const targetNode = selectNode(state.nodes, body.node || null);
      const deployment = {
        id: crypto.randomUUID(),
        app: body.app || "New App",
        image: body.image || "izakhono/app:latest",
        node: targetNode.name,
        status: "queued",
        url: body.url || null,
        createdAt: new Date().toISOString()
      };
      const workload = {
        id: crypto.randomUUID(),
        deploymentId: deployment.id,
        app: deployment.app,
        image: deployment.image,
        node: targetNode.name,
        port: body.port ? Number(body.port) : null,
        status: "queued",
        createdAt: new Date().toISOString()
      };
      state.deployments.unshift(deployment);
      state.workloads.unshift(workload);
      return json(res, 202, { message: "Deployment scheduled on IZAKHONO Engine", deployment, workload });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }

  if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "api_route_not_found" });
  serveStatic(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`IZAKHONO Containers listening on http://0.0.0.0:${PORT}`);
});
