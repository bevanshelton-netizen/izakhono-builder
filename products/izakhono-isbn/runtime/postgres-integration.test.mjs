import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import worker from "../src/index.ts";
import { createPostgresD1Adapter } from "../src/postgresql-adapter.ts";

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "izakhono_isbn",
  user: process.env.PGUSER || "izakhono",
  password: process.env.PGPASSWORD || "test-password"
});
const token = "ci-test-admin-token";
const db = createPostgresD1Adapter(pool);
async function api(path, method = "GET", payload) {
  const response = await worker.fetch(new Request("http://registry.test" + path, {
    method,
    headers: { Authorization: "Bearer " + token, ...(payload ? { "content-type":"application/json" } : {}) },
    body: payload ? JSON.stringify(payload) : undefined
  }), { DB: db, ISBN_ADMIN_TOKEN: token });
  return { response, data: await response.json() };
}
try {
  const schema = await readFile(new URL("../postgresql/0001_initial_schema.sql", import.meta.url), "utf8");
  const seed = await readFile(new URL("../postgresql/0002_seed_initial_catalogue.sql", import.meta.url), "utf8");
  await pool.query(schema);
  await pool.query(seed);

  const health = await worker.fetch(new Request("http://registry.test/api/health"), {});
  assert.equal(health.status, 200);
  const dashboard = await api("/api/dashboard");
  assert.equal(dashboard.response.status, 200);
  assert.equal(Number(dashboard.data.works), 7);
  assert.equal(Number(dashboard.data.editions), 1);
  assert.equal(Number(dashboard.data.verifiedIsbns), 0, "seed must not invent ISBN allocations");

  const catalogue = await api("/api/catalogue");
  assert.equal(catalogue.response.status, 200);
  assert.equal(catalogue.data.items.length, 1);
  assert.equal(catalogue.data.items[0].isbn13, null);

  const created = await api("/api/authors", "POST", { display_name: "CI Adapter Test Author" });
  assert.equal(created.response.status, 201);
  const patched = await api("/api/authors", "PATCH", { id: created.data.id, display_name: "CI Updated Author" });
  assert.equal(patched.response.status, 200);

  const correspondence = await api("/api/correspondence");
  assert.equal(correspondence.response.status, 200);
  assert.equal(correspondence.data.items.length, 3);

  await assert.rejects(
    pool.query("UPDATE agency_correspondence SET summary=$1 WHERE id=$2", ["tamper", "correspondence-nlsa-escalation-2026-11-26"]),
    /agency_correspondence_is_append_only/
  );
  await assert.rejects(
    pool.query("INSERT INTO isbn_records (id,edition_id,isbn13,allocation_authority,publisher_of_record,evidence_ref) VALUES ($1,$2,$3,$4,$5,$6)",
      ["invalid-isbn", "edition-business-of-music-epub-2026", "9780306406158", "NLSA", "IZAKHONO AFRICA (PTY) LTD", "test-evidence"]),
    /isbn13_checksum_invalid/
  );

  console.log("Live PostgreSQL schema, seed, API, ISBN guard and correspondence immutability tests passed.");
} finally {
  await pool.end();
}
