import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const root = new URL("../migrations/", import.meta.url);
const db = new DatabaseSync(":memory:");
try {
  for (const name of ["0001_initial.sql", "0002_seed_initial_publisher_and_application.sql", "0003_isbn_integrity_guards.sql"]) {
    db.exec(fs.readFileSync(new URL(name, root), "utf8"));
  }
  const seeded = db.prepare("SELECT legal_name FROM publishers WHERE id=?").get("pub-izakhono-africa");
  assert.equal(seeded.legal_name, "IZAKHONO AFRICA (PTY) LTD");

  function addEdition(id) {
    db.prepare("INSERT INTO editions (id,work_id,format_code) VALUES (?,?,?)")
      .run(id, "work-business-of-music", "EPUB");
  }
  function insertIsbn(id, editionId, isbn, extra = {}) {
    db.prepare("INSERT INTO isbn_records (id,edition_id,isbn13,allocation_authority,publisher_of_record,evidence_ref,allocation_date,verification_status) VALUES (?,?,?,?,?,?,?,?)").run(
      id, editionId, isbn, extra.authority ?? "National Library of South Africa",
      extra.publisher ?? "IZAKHONO AFRICA (PTY) LTD", extra.evidence ?? "nlsa-allocation-letter",
      extra.date ?? "2026-11-26", extra.status ?? "verified"
    );
  }

  addEdition("test-valid-978");
  insertIsbn("isbn-valid-978", "test-valid-978", "9780306406157");
  assert.equal(db.prepare("SELECT isbn13 FROM isbn_records WHERE id=?").get("isbn-valid-978").isbn13, "9780306406157");

  addEdition("test-valid-979");
  insertIsbn("isbn-valid-979", "test-valid-979", "9791090636071");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM isbn_records").get().n, 2);

  addEdition("test-bad-checksum");
  assert.throws(() => insertIsbn("isbn-bad-checksum", "test-bad-checksum", "9780306406158"), /isbn13_checksum_invalid/);

  addEdition("test-noncanonical");
  assert.throws(() => insertIsbn("isbn-noncanonical", "test-noncanonical", "978-0-306-40615-7"), /isbn13_must_be_canonical/);

  addEdition("test-missing-evidence");
  assert.throws(() => insertIsbn("isbn-missing-evidence", "test-missing-evidence", "9780306406157", { evidence: "" }), /allocation_authority_publisher_and_evidence_required/);

  addEdition("test-missing-date");
  assert.throws(() => insertIsbn("isbn-missing-date", "test-missing-date", "9780306406157", { date: null }), /verified_isbn_requires_allocation_date/);

  assert.throws(() => db.prepare("UPDATE isbn_records SET isbn13=? WHERE id=?").run("9780306406158", "isbn-valid-978"), /isbn13_checksum_invalid/);
  console.log("ISBN registry SQLite migration tests passed (8 assertions).");
} finally {
  db.close();
}
