import express from "express";
import { BrainKernel, healthPolicy } from "./brain-kernel.js";
import { loadBrainRegistry } from "./brain-registry.js";

const app = express();
app.use(express.json({ limit: "256kb" }));

const startedAt = new Date().toISOString();
const audit = [];
const registryDocument = loadBrainRegistry();
const policies = Object.fromEntries(
  registryDocument.brains.map(brain => [brain.id, healthPolicy])
);
const kernel = new BrainKernel({ registry: registryDocument.brains, policies });

function record(action, details = {}) {
  audit.push({
    id: `${Date.now()}-${audit.length + 1}`,
    timestamp: new Date().toISOString(),
    action,
    details,
  });
  if (audit.length > 500) audit.shift();
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "izakhono-control-plane",
    mode: "control-plane",
    startedAt,
    liveRequiresHealthCheck: true,
    brainFabric: kernel.status(),
  });
});

app.get("/services", (_req, res) => {
  res.json({
    services: [
      { name: "dns", status: "planned" },
      { name: "edge", status: "planned" },
      { name: "hosting", status: "planned" },
      { name: "email", status: "planned" },
      { name: "data", status: "planned" },
      { name: "identity", status: "planned" },
      { name: "observability", status: "planned" },
      { name: "backup", status: "planned" },
      { name: "billing", status: "planned" },
      { name: "provisioner", status: "planned" },
    ],
  });
});

app.get("/brains", (_req, res) => {
  res.json({
    name: registryDocument.name,
    version: registryDocument.version,
    principles: registryDocument.principles,
    brains: registryDocument.brains,
  });
});

app.get("/brains/status", (_req, res) => {
  res.json({ ...kernel.status(), registryVersion: registryDocument.version });
});

app.get("/brains/health", (_req, res) => {
  res.json({ ok: kernel.status().healthy, ...kernel.status() });
});

app.get("/brains/audit", (_req, res) => {
  res.json({ entries: kernel.audit });
});

app.post("/brains/decide", (req, res) => {
  const request = req.body || {};
  if (!request.brain || !request.intent) {
    return res.status(400).json({ error: "brain and intent are required" });
  }

  const result = kernel.decide(request);
  record("brain.decision", {
    brain: request.brain,
    intent: request.intent,
    state: result.state,
    reason: result.reason,
  });

  const status = result.state === "rejected" ? 400 : result.state === "blocked" ? 403 : 200;
  return res.status(status).json(result);
});

app.get("/audit", (_req, res) => {
  res.json({ entries: audit });
});

app.post("/diagnostics/run", (req, res) => {
  const target = req.body?.target || "unspecified";
  record("diagnostics.requested", { target });
  res.status(202).json({
    accepted: true,
    target,
    status: "queued",
    note: "Diagnostic adapters will execute only when their runtime dependencies are configured.",
  });
});

app.post("/provision", (req, res) => {
  const request = req.body || {};
  if (!request.name || !request.type) {
    return res.status(400).json({ error: "name and type are required" });
  }
  record("provision.requested", { name: request.name, type: request.type });
  res.status(202).json({
    accepted: true,
    requestId: audit.at(-1).id,
    status: "queued",
    live: false,
    rule: "No service is marked live until health checks pass.",
  });
});

app.post("/deploy", (req, res) => {
  const service = req.body?.service;
  if (!service) return res.status(400).json({ error: "service is required" });
  record("deploy.requested", { service });
  res.status(202).json({ accepted: true, service, status: "queued", live: false });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, "0.0.0.0", () => {
  console.log(`IZAKHONO Control Plane listening on ${port}`);
});
