import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = "products/izakhono-isbn/";
const schema = readFileSync(root + "postgresql/0001_initial_schema.sql", "utf8");
const seed = readFileSync(root + "postgresql/0002_seed_initial_catalogue.sql", "utf8");
const contract = readFileSync(root + "src/storage/contract.ts", "utf8");

for (const table of [
  "publishers", "imprints", "authors", "works", "work_authors", "editions",
  "agency_applications", "isbn_records", "legal_deposit_records", "audit_events",
  "agency_correspondence"
]) {
  assert.match(schema, new RegExp("CREATE TABLE " + table + "\\s*\\("), table + " table exists in PostgreSQL schema");
}
assert.match(schema, /CREATE FUNCTION izakhono_isbn13_valid/);
assert.match(schema, /CREATE TRIGGER trg_isbn_integrity/);
assert.match(schema, /verification_status = 'verified'[\s\S]*allocation_date IS NULL/);
assert.match(schema, /CREATE TRIGGER agency_correspondence_no_update/);
assert.match(schema, /BEFORE UPDATE OR DELETE ON agency_correspondence/);
assert.match(schema, /ON DELETE CASCADE/);
assert.match(seed, /IZAKHONO AFRICA \(PTY\) LTD/);
assert.match(seed, /SELFHELP Stories/);
assert.match(seed, /gmail-message:1a21752f0d53d530/);
assert.doesNotMatch(seed, /INSERT INTO isbn_records/i, "seed must never fabricate ISBNs");
assert.match(contract, /export interface RegistryDatabase/);
assert.match(contract, /transaction<T>/);
assert.match(contract, /parameterised/);
console.log("PostgreSQL target schema and persistence-contract checks passed (24 assertions).");
