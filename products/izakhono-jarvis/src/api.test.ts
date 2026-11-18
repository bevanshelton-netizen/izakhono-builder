import assert from "node:assert/strict";
import { jarvisExecutiveSnapshotRoute } from "./api";

function request(path = "/api/jarvis/executive-snapshot", method = "GET") {
  return new Request("https://builder.example" + path, { method });
}

async function main() {
  let queries = 0;
  const env = {
    DB: {
      prepare(sql: string) {
        assert.match(sql, /FROM builder_projects GROUP BY status/);
        return {
          async all() {
            queries++;
            return { results: [{ status: "draft", total: 2 }, { status: "deployed", total: 1 }] };
          },
        };
      },
    },
  };

  const unauthorized = await jarvisExecutiveSnapshotRoute(request(), env, async () => false);
  assert.equal(unauthorized?.status, 401);
  assert.equal(queries, 0, "unauthorized requests must not query portfolio data");

  const otherPath = await jarvisExecutiveSnapshotRoute(request("/api/other"), env, async () => true);
  assert.equal(otherPath, null);

  const wrongMethod = await jarvisExecutiveSnapshotRoute(request("/api/jarvis/executive-snapshot", "POST"), env, async () => true);
  assert.equal(wrongMethod?.status, 405);

  const response = await jarvisExecutiveSnapshotRoute(request(), env, async () => true);
  assert.equal(response?.status, 200);
  const payload = await response!.json() as any;
  assert.equal(payload.snapshot.portfolio.total_projects, 3);
  assert.equal(payload.snapshot.portfolio.by_status.draft, 2);
  assert.equal(payload.snapshot.financials.revenue_zar, null);
  assert.equal(payload.snapshot.financials.cash_position_zar, null);
  assert.equal(payload.access, "owner-read-only");
  assert.equal(queries, 1);
  console.log("J.A.R.V.I.S. executive snapshot tests passed");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
