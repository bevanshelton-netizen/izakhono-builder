import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, convertInstitutionRows } from "./seed-import.mjs";

test("parses quoted commas and escaped quotes in CSV", () => {
  const rows = parseCsv('id,name,note\n1,"College, Central","He said ""hello"""\n');
  assert.equal(rows[0].name, "College, Central");
  assert.equal(rows[0].note, 'He said "hello"');
});

test("converts seeded institutions to review-only staging records", () => {
  const rows = parseCsv('record_id,institution_name,institution_type,province,source_name,source_url,notes\nSA-1,Example TVET College,Public TVET college,Gauteng,DHET,https://example.org,check name\n');
  const [record] = convertInstitutionRows(rows);
  assert.equal(record.id, "SA-1");
  assert.equal(record.institution_type, "public-tvet");
  assert.equal(record.verification.status, "needs-review");
  assert.equal(record.registration_status, "unknown");
  assert.equal(record.import_status, "staged-not-published");
});

test("does not silently mark any imported row verified", () => {
  const rows = parseCsv('record_id,institution_name,institution_type,source_url,verification_status\nSA-2,Example University,Public university,https://example.org,verified\n');
  const [record] = convertInstitutionRows(rows);
  assert.equal(record.verification.status, "needs-review");
});
