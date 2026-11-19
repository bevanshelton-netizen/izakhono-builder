import { strict as assert } from "node:assert";
import { default as worker } from "./worker-persistent";

const protectedRoutes: Array<{ path: string; method?: string }> = [
  { path: "/control-plane/status" },
  { path: "/control-plane/diagnose?domain=example.com" },
  { path: "/workers/status" },
  { path: "/workers/queue" },
  { path: "/workers/jobs" },
  { path: "/workers/pump", method: "POST" },
  { path: "/workers/claim", method: "POST" },
  { path: "/native-builder/projects", method: "POST" },
  { path: "/native-builder/jobs", method: "POST" },
];

async function main() {
  const db = { prepare() { throw new Error("database must not be touched before authorization"); } };
  for (const route of protectedRoutes) {
    for (const env of [{ APP_ENV: "production" }, { APP_ENV: "production", REGISTRY_TOKEN_SHA256: "" }]) {
      const response = await worker.fetch(
        new Request(`https://registry.test${route.path}`, { method: route.method ?? "GET" }),
        { ...env, DB: db } as never,
      );
      assert.ok([401, 503].includes(response.status), `unconfigured auth must deny ${route.path}; received ${response.status}`);
      assert.equal(response.status === 401 || response.status === 503, true);
    }
  }
  console.log(`persistent worker auth tests: ok (${protectedRoutes.length} protected routes deny before database access)`);
}
void main();
