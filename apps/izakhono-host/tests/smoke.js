import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const port = 8899;
const data = fs.mkdtempSync(path.join(os.tmpdir(), "izakhono-host-"));
const child = spawn(process.execPath, ["src/server.js"], {
  cwd: new URL("..", import.meta.url).pathname,
  env: { ...process.env, PORT: String(port), IZAKHONO_HOST_DATA: data, IZAKHONO_HOST_ADMIN_TOKEN: "test-token", NODE_ENV: "production" },
  stdio: "ignore"
});

const request = (method, url, body) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: "127.0.0.1", port, path: url, method, headers: { authorization: "Bearer test-token", "content-type": "application/json" } }, res => {
    let raw = ""; res.on("data", c => raw += c); res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
  });
  req.on("error", reject); if (body) req.write(JSON.stringify(body)); req.end();
});

try {
  await new Promise(r => setTimeout(r, 200));
  const health = await request("GET", "/health");
  assert.equal(health.status, 200); assert.equal(health.body.engine, "izakhono-host");
  const tenant = await request("POST", "/api/v1/tenants", { name: "Smoke Tenant" });
  assert.equal(tenant.status, 201);
  const project = await request("POST", "/api/v1/projects", { tenant_id: tenant.body.id, name: "Smoke App" });
  assert.equal(project.status, 201);
  const domain = await request("POST", `/api/v1/projects/${project.body.id}/domains`, { hostname: "smoke.example" });
  assert.equal(domain.status, 201); assert.equal(domain.body.status, "pending");
  const deployment = await request("POST", "/api/v1/deployments", { project_id: project.body.id, repository: "owner/repo", commit: "abc123" });
  assert.equal(deployment.status, 202); assert.equal(deployment.body.state, "queued");
  const metrics = await request("GET", "/api/v1/metrics");
  assert.equal(metrics.body.tenants, 1); assert.equal(metrics.body.projects, 1); assert.equal(metrics.body.deployments, 1);
  console.log("IZAKHONO HOST smoke test passed");
} finally {
  child.kill("SIGTERM"); fs.rmSync(data, { recursive: true, force: true });
}
