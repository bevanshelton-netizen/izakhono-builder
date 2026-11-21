// Explicit, transactional schema installation. This is never run automatically at API startup.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Pool } from "pg";

if (process.env.JARVIS_ALLOW_SCHEMA_MIGRATION !== "1") {
  throw new Error("Set JARVIS_ALLOW_SCHEMA_MIGRATION=1 to explicitly authorise schema installation");
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 5000,
  application_name: "izakhono-jarvis-schema-installer",
  ssl: process.env.DATABASE_SSLMODE === "disable" ? false : { rejectUnauthorized: true },
});
const here = dirname(fileURLToPath(import.meta.url));
const migration = resolve(here, "postgres", "0001_jarvis_owned_runtime.sql");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(7412052026)");
  await client.query("CREATE TABLE IF NOT EXISTS jarvis_schema_migrations (version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const version = "0001_jarvis_owned_runtime";
  const existing = await client.query("SELECT checksum FROM jarvis_schema_migrations WHERE version=$1", [version]);
  const sql = await readFile(migration, "utf8");
  const { createHash } = await import("node:crypto");
  const checksum = createHash("sha256").update(sql).digest("hex");
  if (existing.rowCount) {
    if (existing.rows[0].checksum !== checksum) throw new Error("Installed J.A.R.V.I.S. schema checksum differs; manual reconciliation required");
    process.stdout.write("J.A.R.V.I.S. PostgreSQL schema already installed; checksum verified.\n");
  } else {
    await client.query(sql);
    await client.query("INSERT INTO jarvis_schema_migrations(version,checksum) VALUES($1,$2)", [version, checksum]);
    process.stdout.write("Installed J.A.R.V.I.S. PostgreSQL schema 0001 transactionally.\n");
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
