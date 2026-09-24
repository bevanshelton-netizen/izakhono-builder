import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const port = 18080 + Math.floor(Math.random() * 1000);
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "izakhono-crm-"));
const dataFile = path.join(dir, "crm.json");
const child = spawn(process.execPath, ["server.js"], {
  cwd: new URL(".", import.meta.url),
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), CRM_DATA_FILE: dataFile },
  stdio: ["ignore", "pipe", "pipe"]
});

async function waitForHealth() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("server did not become healthy");
}

const scopedHeaders = { "content-type": "application/json", "x-entity-id": "izakhono-africa", "x-platform-id": "faisready" };

test("CRM health, scoped intake and summary", async () => {
  await waitForHealth();
  const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
  assert.equal(health.ok, true);

  const intake = await fetch(`http://127.0.0.1:${port}/api/intake`, {
    method: "POST",
    headers: scopedHeaders,
    body: JSON.stringify({
      contact: { name: "Test Lead", email: "lead@example.test", source: "unit-test" },
      create_deal: true,
      deal: { title: "RE5 preparation", value: 299, currency: "ZAR", stage: "Lead" }
    })
  });
  assert.equal(intake.status, 201);

  const summary = await fetch(`http://127.0.0.1:${port}/api/summary`, { headers: scopedHeaders }).then((r) => r.json());
  assert.equal(summary.contacts, 1);
  assert.equal(summary.open_deals, 1);
  assert.equal(summary.pipeline_value, 299);

  const otherScope = await fetch(`http://127.0.0.1:${port}/api/summary`, {
    headers: { ...scopedHeaders, "x-platform-id": "kora" }
  }).then((r) => r.json());
  assert.equal(otherScope.contacts, 0);
  assert.equal(otherScope.open_deals, 0);
});


test("dry-run intake validates without persistence", async () => {
  await waitForHealth();
  const before = await fetch(`http://127.0.0.1:${port}/api/summary`, { headers: scopedHeaders }).then((r) => r.json());
  const r = await fetch(`http://127.0.0.1:${port}/api/intake?dry_run=true`, {
    method: "POST",
    headers: scopedHeaders,
    body: JSON.stringify({
      contact: { name: "Dry Run", email: "dryrun@example.test" },
      create_deal: true,
      deal: { title: "Validation only", stage: "Lead", external_ref: "dry-run-only" }
    })
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.dry_run, true);
  const after = await fetch(`http://127.0.0.1:${port}/api/summary`, { headers: scopedHeaders }).then((r) => r.json());
  assert.equal(after.contacts, before.contacts);
  assert.equal(after.open_deals, before.open_deals);
});

test("external_ref makes repeated platform events idempotent", async () => {
  await waitForHealth();
  const event = {
    contact: { name: "Repeat Lead", email: "repeat@example.test", source: "fabric-test" },
    create_deal: true,
    deal: { title: "RE5 preparation", value: 299, currency: "ZAR", stage: "Lead", external_ref: "faisready:lead-123" }
  };
  const first = await fetch(`http://127.0.0.1:${port}/api/intake`, {
    method: "POST", headers: scopedHeaders, body: JSON.stringify(event)
  });
  assert.equal(first.status, 201);
  event.deal.stage = "Checkout started";
  const second = await fetch(`http://127.0.0.1:${port}/api/intake`, {
    method: "POST", headers: scopedHeaders, body: JSON.stringify(event)
  });
  assert.equal(second.status, 201);

  const deals = await fetch(`http://127.0.0.1:${port}/api/deals`, { headers: scopedHeaders }).then((r) => r.json());
  const matches = deals.items.filter((d) => d.external_ref === "faisready:lead-123");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].stage, "Checkout started");

  const dealOnly = await fetch(`http://127.0.0.1:${port}/api/intake`, {
    method: "POST",
    headers: scopedHeaders,
    body: JSON.stringify({
      create_deal: true,
      deal: { title: "RE5 preparation", stage: "Active learner", external_ref: "faisready:lead-123" }
    })
  });
  assert.equal(dealOnly.status, 201);
  const updated = await fetch(`http://127.0.0.1:${port}/api/deals`, { headers: scopedHeaders }).then((r) => r.json());
  assert.equal(updated.items.find((d) => d.external_ref === "faisready:lead-123").stage, "Active learner");
});

test.after(async () => {
  child.kill("SIGTERM");
  await fs.rm(dir, { recursive: true, force: true });
});
