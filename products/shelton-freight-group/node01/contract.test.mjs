import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../../", import.meta.url);
const client = await readFile(new URL("products/shelton-freight-group/node01/client.ts", root), "utf8");
const gateway = await readFile(new URL("products/izakhono-one/node-gateway.mjs", root), "utf8");
const control = await readFile(new URL("products/izakhono-one/services/persistent-node-control.mjs", root), "utf8");

test("SFG adapter uses the verified IZAKHONO ONE gateway routes", () => {
  assert.ok(client.includes('request("/api/nodes")'));
  assert.ok(client.includes('request("/api/nodes/"+encodeURIComponent(nodeId)+"/workload"'));
  assert.ok(gateway.includes("url.pathname === '/api/nodes'"));
  assert.ok(gateway.includes("action === 'workload'"));
});

test("SFG adapter fails closed on missing credentials and non-HTTPS origins", () => {
  assert.ok(client.includes("NODE_CONTROL_NOT_CONFIGURED"));
  assert.ok(client.includes('url.protocol!=="https:"'));
  assert.ok(client.includes('redirect:"manual"'));
  assert.ok(client.includes("AbortSignal.timeout(6000)"));
});

test("workload authorization is separate from node deployment reporting", () => {
  assert.ok(client.includes("FORTRESS workload authorization only"));
  assert.ok(control.includes("async function authorizeWorkload"));
  assert.ok(control.includes("async function recordDeployment"));
  assert.ok(gateway.includes("action === 'deploy'"));
});
