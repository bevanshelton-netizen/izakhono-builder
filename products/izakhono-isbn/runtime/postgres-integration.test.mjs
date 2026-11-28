import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import worker from "../src/index.ts";
import { createPostgresD1Adapter } from "../src/postgresql-adapter.ts";
import { importExport } from "../migration/d1-export-to-postgres.mjs";

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

  const unauthenticatedExport = await worker.fetch(new Request("http://registry.test/api/export/registry.json"), { DB: db, ISBN_ADMIN_TOKEN: token });
  assert.equal(unauthenticatedExport.status, 401, "full registry export must require bearer authentication");
  const fullExport = await api("/api/export/registry.json");
  assert.equal(fullExport.response.status, 200);
  assert.equal(fullExport.data.formatVersion, 1);
  assert.equal(fullExport.data.source, "izakhono-isbn-d1-export");
  assert.ok(Array.isArray(fullExport.data.tables.publishers));
  assert.ok(Array.isArray(fullExport.data.tables.agency_correspondence));
  assert.equal(fullExport.data.tables.agency_correspondence.length, 3);
  assert.ok(!JSON.stringify(fullExport.data).includes(token), "export must not include the admin token");

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


  // Exercise the real D1-export importer against an isolated PostgreSQL schema.
  const migrationSchema = `migration_rehearsal_${process.pid}`;
  await pool.query(`CREATE SCHEMA "${migrationSchema}"`);
  try {
    const migrationClient = await pool.connect();
    try {
      await migrationClient.query(`SET search_path TO "${migrationSchema}"`);
      await migrationClient.query(schema);
    } finally { migrationClient.release(); }
    const migrationPool = {
      connect: async () => {
        const client = await pool.connect();
        await client.query(`SET search_path TO "${migrationSchema}"`);
        return client;
      }
    };
    const exportFixture = {
      formatVersion: 1,
      source: "izakhono-isbn-d1-export",
      exportedAt: new Date().toISOString(),
      tables: {
        publishers: [{ id: "mig-publisher", legal_name: "Migration Rehearsal Publisher", country_code: "ZA" }],
        imprints: [{ id: "mig-imprint", publisher_id: "mig-publisher", name: "Rehearsal Imprint", active: true }],
        authors: [{ id: "mig-author", display_name: "Rehearsal Author" }],
        works: [{ id: "mig-work", publisher_id: "mig-publisher", imprint_id: "mig-imprint", title: "Migration Rehearsal", language_code: "en", publication_status: "development" }],
        work_authors: [{ work_id: "mig-work", author_id: "mig-author", contributor_role: "author", display_order: 1 }],
        editions: [{ id: "mig-edition", work_id: "mig-work", edition_statement: "First edition", format_code: "EPUB", language_code: "en", status: "planned" }],
        agency_applications: [{ id: "mig-application", agency_name: "NLSA", status: "submitted", titles_json: "[]" }],
        isbn_records: [{ id: "mig-isbn", edition_id: "mig-edition", isbn13: "9780306406157", allocation_authority: "NLSA", allocation_date: "2026-11-27", publisher_of_record: "Migration Rehearsal Publisher", verification_status: "verified", evidence_ref: "rehearsal-evidence" }],
        legal_deposit_records: [{ id: "mig-deposit", edition_id: "mig-edition", jurisdiction: "ZA", required: true, status: "not_started" }],
        audit_events: [{ id: "mig-audit", actor: "ci", action: "migration_test", entity_type: "work", entity_id: "mig-work", detail_json: { source: "ci" } }],
        agency_correspondence: [{ id: "mig-correspondence", application_id: "mig-application", direction: "outgoing", occurred_at: "2026-11-27T10:00:00Z", recipient: "agency@example.invalid", subject: "Rehearsal", evidence_ref: "mail-evidence", summary: "Migration rehearsal correspondence" }]
      }
    };
    const rehearsal = await importExport(migrationPool, exportFixture);
    assert.equal(rehearsal.mode, "dry-run-rolled-back");
    assert.equal(rehearsal.counts.agency_correspondence, 1);
    const afterDryRun = await pool.query(`SELECT count(*)::int AS count FROM "${migrationSchema}".publishers`);
    assert.equal(afterDryRun.rows[0].count, 0, "dry-run must leave no committed publisher rows");
    const applied = await importExport(migrationPool, exportFixture, { apply: true });
    assert.equal(applied.mode, "applied");
    assert.equal(applied.counts.publishers, 1);
    assert.equal(applied.counts.isbn_records, 1);
    assert.equal(applied.counts.agency_correspondence, 1);
    const imported = await pool.query(`SELECT isbn13, verification_status FROM "${migrationSchema}".isbn_records WHERE id='mig-isbn'`);
    assert.equal(imported.rows[0].isbn13, "9780306406157");
    assert.equal(imported.rows[0].verification_status, "verified");
    await assert.rejects(
      pool.query(`UPDATE "${migrationSchema}".agency_correspondence SET summary='tampered' WHERE id='mig-correspondence'`),
      /agency_correspondence_is_append_only/
    );
    console.log("Live D1-to-PostgreSQL migration dry-run, commit, ISBN evidence and correspondence immutability tests passed.");
  } finally {
    await pool.query(`DROP SCHEMA "${migrationSchema}" CASCADE`);
  }

  console.log("Live PostgreSQL schema, seed, API, ISBN guard and correspondence immutability tests passed.");
} finally {
  await pool.end();
}
