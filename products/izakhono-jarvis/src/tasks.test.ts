import assert from "node:assert/strict";
import { jarvisTasksRoute } from "./tasks";

function req(method: string, body?: unknown, path = "/api/jarvis/tasks") {
  return new Request("https://builder.example" + path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function main() {
  let reads = 0, writes = 0, bound: unknown[] = [];
  const env = { DB: { prepare(sql: string) {
    return { bind(...values: unknown[]) {
      bound = values;
      return {
        async all() { reads++; assert.match(sql, /owner_scope='owner'/); return { results: [{ id: "tsk_1", title: "Test" }] }; },
        async run() { writes++; assert.match(sql, /INSERT INTO jarvis_tasks/); return {}; },
      };
    }};
  }}};
  const denied = await jarvisTasksRoute(req("GET"), env, async () => false);
  assert.equal(denied?.status, 401); assert.equal(reads, 0); assert.equal(writes, 0);
  const wrongPath = await jarvisTasksRoute(req("GET", undefined, "/api/other"), env, async () => true);
  assert.equal(wrongPath, null);
  const badLimit = await jarvisTasksRoute(req("GET", undefined, "/api/jarvis/tasks?limit=500"), env, async () => true);
  assert.equal(badLimit?.status, 400);
  const list = await jarvisTasksRoute(req("GET"), env, async () => true);
  assert.equal(list?.status, 200); assert.equal(reads, 1);
  const invalid = await jarvisTasksRoute(req("POST", { title: "" }), env, async () => true);
  assert.equal(invalid?.status, 400); assert.equal(writes, 0);
  const created = await jarvisTasksRoute(req("POST", { title: "Prepare board pack", priority: "high", description: "Q4 review" }), env, async () => true);
  assert.equal(created?.status, 201); assert.equal(writes, 1);
  assert.equal(bound[0] && typeof bound[0], "string");
  assert.equal(bound[1], "Prepare board pack"); assert.equal(bound[3], "high");
  console.log("J.A.R.V.I.S. task API tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
