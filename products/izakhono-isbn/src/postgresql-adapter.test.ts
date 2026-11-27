import assert from "node:assert/strict";
import { createPostgresD1Adapter, type PgPoolLike } from "./postgresql-adapter.js";

const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
const pool: PgPoolLike = {
  async query(sql, values) {
    calls.push({ sql, values });
    if (sql.startsWith("SELECT")) return { rows: [{ n: 4 }], rowCount: 1 };
    return { rows: [], rowCount: 2 };
  },
};
const db = createPostgresD1Adapter(pool);
const count = await db.prepare("SELECT COUNT(*) n FROM works WHERE publisher_id=? AND title=?").bind("pub-1", "A title").first<{n:number}>();
assert.deepEqual(count, { n: 4 });
assert.deepEqual(calls[0], { sql:"SELECT COUNT(*) n FROM works WHERE publisher_id=$1 AND title=$2", values:["pub-1","A title"] });
const result = await db.prepare("UPDATE works SET title=? WHERE id=?").bind("Updated", "work-1").run();
assert.equal(result.meta.changes, 2);
assert.throws(() => db.prepare("SELECT 1; SELECT 2"), /single_statement_required/);
console.log("PostgreSQL compatibility adapter tests passed (4 assertions).");
