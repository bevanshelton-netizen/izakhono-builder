import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const client = await readFile(new URL("products/shelton-freight-group/node01/client.ts", root), "utf8");
const gateway = await readFile(new URL("products/izakhono-one/node-gateway.mjs", root), "utf8");
const control = await readFile(new URL("products/izakhono-one/services/persistent-node-control.mjs", root), "utf8");

test("SFG adapter uses the verified IZAKHONO ONE gateway routes", () => {
  assert.match(client, /request\("\/api\/nodes"\)/);
  assert.match(client, /\/api\/nodes\/\+encodeURIComponent\(nodeId\)\+"\/workload"/);
  assert.match(gateway, /url\.pathname === '\/api\/nodes'/);
  assert.match(gateway, /action === 'workload'/);
});

test("SFG adapter fails closed on missing credentials and non-HTTPS origins", () => {
  assert.match(client, /NODE_CONTROL_NOT_CONFIGURED/);
  assert.match(client, /url\.protocol!=="https:"/);
  assert.match(client, /redirect:"manual"/);
  assert.match(client, /AbortSignal\.timeout\(6000\)/);
});

test("workload authorization is separate from node deployment reporting", () => {
  assert.match(client, /FORTRESS workload authorization only/);
  assert.match(control, /async function authorizeWorkload/);
  assert.match(control, /async function recordDeployment/);
  assert.match(gateway, /action === 'deploy'/);
});
