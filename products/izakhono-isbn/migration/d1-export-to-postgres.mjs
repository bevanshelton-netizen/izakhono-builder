#!/usr/bin/env node
/**
 * Safe D1 JSON export -> PostgreSQL import.
 * Dry-run is the default: all inserts are attempted in one transaction and rolled back.
 * Use --apply only after independently backing up both databases and approving the target.
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const TABLES = Object.freeze({
  publishers: ["id","legal_name","company_registration","country_code","physical_address","postal_address","contact_name","contact_email","contact_phone","website_url","created_at","updated_at"],
  imprints: ["id","publisher_id","name","description","active","created_at"],
  authors: ["id","display_name","legal_name","pen_name","email","created_at"],
  works: ["id","publisher_id","imprint_id","title","subtitle","language_code","description","subject_codes","publication_status","created_at","updated_at"],
  work_authors: ["work_id","author_id","contributor_role","display_order"],
  editions: ["id","work_id","edition_statement","format_code","language_code","publication_date","publication_place","publisher_display","page_count","duration_seconds","file_master_ref","distribution_channels","status","created_at"],
  agency_applications: ["id","agency_name","contact_person","contact_email","submitted_at","follow_up_at","reference_number","status","titles_json","correspondence_notes","evidence_ref","next_action","created_at","updated_at"],
  isbn_records: ["id","edition_id","isbn13","allocation_authority","allocation_date","publisher_of_record","verification_status","evidence_ref","barcode_asset_ref","created_at"],
  legal_deposit_records: ["id","edition_id","jurisdiction","required","due_date","submitted_at","recipient","proof_ref","status","notes","created_at"],
  audit_events: ["id","actor","action","entity_type","entity_id","detail_json","created_at"],
  agency_correspondence: ["id","application_id","direction","occurred_at","recipient","cc","subject","evidence_ref","summary","created_at"]
});
export const INSERT_ORDER = Object.freeze(["publishers","imprints","authors","works","work_authors","editions","agency_applications","isbn_records","legal_deposit_records","audit_events","agency_correspondence"]);
const BOOLEAN_COLUMNS = new Set(["imprints.active","authors.pen_name","legal_deposit_records.required"]);

export function isbn13Valid(value) {
  const s = String(value ?? "").replace(/[ -]/g, "");
  if (!/^97[89]\d{10}$/.test(s)) return false;
  let sum = 0;
  for (let i=0;i<12;i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(s[12]);
}

export function validateExport(doc) {
  const errors = [];
  if (!doc || doc.formatVersion !== 1 || doc.source !== "izakhono-isbn-d1-export" || !doc.tables || typeof doc.tables !== "object") {
    return { errors: ["Unsupported export envelope; expected formatVersion 1 and source izakhono-isbn-d1-export."], counts: {} };
  }
  for (const name of Object.keys(doc.tables)) {
    if (!Object.hasOwn(TABLES, name)) errors.push(`Unknown table: ${name}`);
    else if (!Array.isArray(doc.tables[name])) errors.push(`Table ${name} must be an array.`);
  }
  const counts = {};
  for (const name of INSERT_ORDER) {
    const rows = doc.tables[name] ?? [];
    counts[name] = Array.isArray(rows) ? rows.length : 0;
    if (!Array.isArray(rows)) continue;
    for (let i=0;i<rows.length;i++) {
      const row = rows[i];
      const prefix = `${name}[${i}]`;
      if (!row || typeof row !== "object" || Array.isArray(row)) { errors.push(`${prefix} must be an object.`); continue; }
      for (const key of Object.keys(row)) if (!TABLES[name].includes(key)) errors.push(`${prefix} contains unsupported column: ${key}`);
      if (name !== "work_authors" && (typeof row.id !== "string" || !row.id.trim())) errors.push(`${prefix}.id is required.`);
      if (name === "work_authors" && (!row.work_id || !row.author_id || !row.contributor_role)) errors.push(`${prefix} requires work_id, author_id and contributor_role.`);
      if (name === "isbn_records") {
        const isbn = String(row.isbn13 ?? "").replace(/[ -]/g, "");
        if (!isbn13Valid(isbn)) errors.push(`${prefix} has an invalid ISBN-13 checksum.`);
        if (!String(row.allocation_authority ?? "").trim()) errors.push(`${prefix} is missing allocation authority.`);
        if (!String(row.evidence_ref ?? "").trim()) errors.push(`${prefix} is missing allocation evidence reference.`);
        if (row.verification_status === "verified" && !row.allocation_date) errors.push(`${prefix} is verified without an allocation date.`);
      }
      if (name === "agency_correspondence" && !String(row.summary ?? "").trim()) errors.push(`${prefix}.summary is required.`);
      if (name === "audit_events" && row.detail_json != null) {
        try { if (typeof row.detail_json === "string") JSON.parse(row.detail_json); }
        catch { errors.push(`${prefix}.detail_json is not valid JSON.`); }
      }
    }
  }
  return { errors, counts };
}

function valueFor(table, column, value) {
  if (value === undefined) return null;
  if (BOOLEAN_COLUMNS.has(`${table}.${column}`) && value !== null) return value === true || value === 1 || value === "1";
  if (table === "isbn_records" && column === "isbn13" && value != null) return String(value).replace(/[ -]/g, "");
  if (table === "audit_events" && column === "detail_json" && typeof value === "string") return JSON.parse(value);
  return value;
}

export async function importExport(pool, doc, { apply = false } = {}) {
  const checked = validateExport(doc);
  if (checked.errors.length) throw new Error("export_validation_failed:\n" + checked.errors.join("\n"));
  const inserted = {};
  await pool.query("BEGIN");
  try {
    for (const table of INSERT_ORDER) {
      const rows = doc.tables[table] ?? [];
      inserted[table] = 0;
      for (const row of rows) {
        const columns = TABLES[table].filter(c => Object.hasOwn(row, c));
        if (!columns.length) throw new Error(`${table} row has no importable columns`);
        const values = columns.map(c => valueFor(table,c,row[c]));
        const placeholders = values.map((_,i)=>`$${i+1}`).join(", ");
        const sql = `INSERT INTO "${table}" (${columns.map(c=>`"${c}"`).join(", ")}) VALUES (${placeholders})`;
        await pool.query(sql, values);
        inserted[table]++;
      }
    }
    if (apply) await pool.query("COMMIT");
    else await pool.query("ROLLBACK");
  } catch (error) {
    try { await pool.query("ROLLBACK"); } catch {}
    throw error;
  }
  return { mode: apply ? "applied" : "dry-run-rolled-back", counts: inserted };
}

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  if (inputIndex < 0 || !args[inputIndex+1]) throw new Error("Usage: node d1-export-to-postgres.mjs --input <export.json> [--apply]");
  const apply = args.includes("--apply");
  const raw = await readFile(args[inputIndex+1], "utf8");
  const doc = JSON.parse(raw);
  const checked = validateExport(doc);
  if (checked.errors.length) throw new Error("Export rejected:\n" + checked.errors.join("\n"));
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required; no connection attempted.");
  const require = createRequire(new URL("../runtime/package.json", import.meta.url));
  const pg = require("pg");
  const pool = new pg.Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  try {
    const result = await importExport(pool, doc, { apply });
    process.stdout.write(JSON.stringify({ ...result, note: apply ? "Committed. Verify row counts and retain the source backup." : "No data committed. Validation transaction was rolled back." }, null, 2) + "\n");
  } finally { await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(String(error.stack ?? error) + "\n"); process.exitCode = 1; });
