import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../../", import.meta.url);
const client = await readFile(new URL("products/shelton-freight-group/node01/client.ts", root), "utf8");
const gateway = await readFile(new URL("products/izakhono-one/node-gateway.mjs", root), "utf8");
const control = await readFile(new URL("products/izakhono-one/services/persistent-node-control.mjs", root), "utf8");
const edgeApi = await readFile(new URL("products/izakhono-one/supabase/functions/izakhono-one-api/index.ts", root), "utf8");

test("SFG adapter uses the verified IZAKHONO ONE gateway routes", () => {
  assert.ok(client.includes('request("/api/nodes")'));
  assert.ok(client.includes('request("/api/nodes/"+encodeURIComponent(nodeId)+"/workload"'));
  assert.ok(gateway.includes("url.pathname === '/api/nodes'"));
  assert.ok(gateway.includes("action === 'workload'"));
});

test("gateway isolates its public listener from the internal ONE service port", () => {
  assert.ok(gateway.includes("process.env.PUBLIC_PORT || process.env.PORT || 8780"));
  assert.ok(gateway.includes("process.env.IZAKHONO_ONE_INTERNAL_PORT || 8781"));
  assert.ok(gateway.includes("publicPort === internalPort"));
  assert.ok(gateway.includes("process.env.PORT = String(internalPort)"));
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

test("deployed IZAKHONO ONE Edge Function contains the node-control security contract", () => {
  assert.ok(edgeApi.includes('action==="node_control"'));
  assert.ok(edgeApi.includes("node_control_credentials"));
  assert.ok(edgeApi.includes("node_agent_credentials"));
  assert.ok(edgeApi.includes("nodeFortress"));
  assert.ok(edgeApi.includes('token_delivery:"one_time_only"'));
  assert.ok(edgeApi.includes('"Accept-Profile":"one"'));
  assert.ok(edgeApi.includes('"Content-Profile":"one"'));
});
