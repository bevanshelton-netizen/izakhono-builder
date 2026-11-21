import assert from "node:assert/strict";
import { createJarvisPostgresAdapter, translateJarvisSql } from "./db.mjs";

async function main() {
  assert.equal(
    translateJarvisSql("SELECT * FROM queue WHERE id=? AND datetime(lease_until)>CURRENT_TIMESTAMP"),
    "SELECT * FROM queue WHERE id=$1 AND (lease_until)::timestamptz>CURRENT_TIMESTAMP",
  );
  assert.match(
    translateJarvisSql("SELECT 1 FROM json_each(s.depends_on_json) d WHERE d.value=?"),
    /jsonb_array_elements_text\(\(s\.depends_on_json\)::jsonb\) AS d\(value\).*d\.value=\$1/,
  );
  const calls = [];
  const pool = { async query(sql, values) { calls.push({ sql, values }); return { rows: [{ id: "step-1" }], rowCount: 1 }; } };
  const db = createJarvisPostgresAdapter(pool);
  const selected = await db.prepare("SELECT * FROM jarvis_tasks WHERE id=?").bind("task-1").first();
  assert.equal(selected.id, "step-1");
  assert.deepEqual(calls[0].values, ["task-1"]);
  const listed = await db.prepare("SELECT * FROM jarvis_tasks").all();
  assert.equal(listed.results.length, 1);
  const changed = await db.prepare("UPDATE jarvis_tasks SET status=? WHERE id=?").bind("done", "task-1").run();
  assert.equal(changed.meta.changes, 1);
  assert.equal(calls[2].sql, "UPDATE jarvis_tasks SET status=$1 WHERE id=$2");
  console.log("J.A.R.V.I.S. PostgreSQL adapter tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
