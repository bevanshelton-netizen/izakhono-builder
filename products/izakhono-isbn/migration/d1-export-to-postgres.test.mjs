import test from "node:test";
import assert from "node:assert/strict";
import { validateExport, isbn13Valid, importExport, INSERT_ORDER } from "./d1-export-to-postgres.mjs";

const valid = {
  formatVersion: 1, source: "izakhono-isbn-d1-export", exportedAt: "2026-11-27T00:00:00Z",
  tables: {
    publishers: [{ id: "p1", legal_name: "IZAKHONO AFRICA (PTY) LTD" }],
    editions: [{ id: "e1", work_id: "w1", format_code: "EPUB" }],
    isbn_records: [{ id: "i1", edition_id: "e1", isbn13: "9780306406157", allocation_authority: "NLSA", allocation_date: "2026-11-27", publisher_of_record: "IZAKHONO AFRICA (PTY) LTD", verification_status: "verified", evidence_ref: "agency-document-1" }]
  }
};

test("validates known ISBN-13 checksum", () => {
  assert.equal(isbn13Valid("9780306406157"), true);
  assert.equal(isbn13Valid("9780306406158"), false);
});
test("accepts a well-formed export and reports table counts", () => {
  const result = validateExport(valid);
  assert.deepEqual(result.errors, []);
  assert.equal(result.counts.publishers, 1);
  assert.equal(result.counts.isbn_records, 1);
});
test("rejects unknown tables and columns", () => {
  const doc = { ...valid, tables: { ...valid.tables, users: [], publishers: [{ id: "p1", password: "secret" }] } };
  const result = validateExport(doc);
  assert.ok(result.errors.some(x => x.includes("Unknown table: users")));
  assert.ok(result.errors.some(x => x.includes("unsupported column: password")));
});
test("rejects invalid or undocumented ISBNs", () => {
  const doc = structuredClone(valid);
  doc.tables.isbn_records[0].isbn13 = "9780306406158";
  doc.tables.isbn_records[0].evidence_ref = null;
  const result = validateExport(doc);
  assert.ok(result.errors.some(x => x.includes("invalid ISBN-13")));
  assert.ok(result.errors.some(x => x.includes("evidence reference")));
});
test("rejects verified ISBN without allocation date", () => {
  const doc = structuredClone(valid);
  doc.tables.isbn_records[0].allocation_date = null;
  assert.ok(validateExport(doc).errors.some(x => x.includes("without an allocation date")));
});
test("dry-run rolls back; apply commits; insertion order preserves dependencies", async () => {
  const calls = [];
  const pool = { query: async (sql, values) => { calls.push({sql,values}); return { rows: [], rowCount: 1 }; } };
  const dry = await importExport(pool, valid);
  assert.equal(dry.mode, "dry-run-rolled-back");
  assert.equal(calls.at(-1).sql, "ROLLBACK");
  calls.length = 0;
  const applied = await importExport(pool, valid, { apply: true });
  assert.equal(applied.mode, "applied");
  assert.equal(calls.at(-1).sql, "COMMIT");
  assert.ok(INSERT_ORDER.indexOf("publishers") < INSERT_ORDER.indexOf("works"));
});
