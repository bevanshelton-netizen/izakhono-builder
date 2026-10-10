import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 18887;
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL(".", import.meta.url),
  env: { ...process.env, MEDIA_CORE_PORT: String(port), MEDIA_ADMIN_TOKEN: "test-token", MEDIA_DATA_DIR: ".test-data" },
  stdio: "ignore"
});

const waitForHealth = async (timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
      lastError = new Error(`health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw lastError || new Error("media-core health check timed out");
};

const api = async (path, options = {}) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

test.before(async () => { await waitForHealth(); });
test.after(() => { child.kill("SIGTERM"); });

test("health endpoint works", async () => {
  const result = await api("/health");
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
});

test("channel creation is authenticated and approval gated", async () => {
  const denied = await api("/api/channels", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Test TV" }) });
  assert.equal(denied.status, 401);

  const created = await api("/api/channels", { method: "POST", headers: { authorization: "Bearer test-token", "content-type": "application/json" }, body: JSON.stringify({ name: "Test TV" }) });
  assert.equal(created.status, 201);
  assert.equal(created.body.status, "draft");
  assert.equal(created.body.approved, false);
  assert.ok(created.body.stream_key);

  const approved = await api(`/api/channels/${created.body.id}/approve`, { method: "POST", headers: { authorization: "Bearer test-token", "content-type": "application/json" }, body: JSON.stringify({ reviewer: "test" }) });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, "approved");
  assert.equal(approved.body.approved, true);
});
