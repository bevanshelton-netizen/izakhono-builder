import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const root = new URL("../migrations/", import.meta.url);
const db = new DatabaseSync(":memory:");
try {
  for (const name of ["0001_initial.sql", "0002_seed_initial_publisher_and_application.sql", "0003_isbn_integrity_guards.sql", "0004_seed_selfhelp_first_season.sql", "0005_agency_correspondence_history.sql"]) {
    db.exec(fs.readFileSync(new URL(name, root), "utf8"));
  }
  const seeded = db.prepare("SELECT legal_name FROM publishers WHERE id=?").get("pub-izakhono-africa");
  assert.equal(seeded.legal_name, "IZAKHONO AFRICA (PTY) LTD");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM works WHERE id LIKE 'work-the-%'").get().n, 6);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM agency_correspondence WHERE application_id=?").get("application-nlsa-business-of-music-2026").n, 3);
  assert.equal(
    db.prepare("SELECT subject FROM agency_correspondence WHERE id=?").get("correspondence-nlsa-escalation-2026-11-26").subject,
    "Escalation: Outstanding ISBN application and publisher registration – IZAKHONO AFRICA (PTY) LTD"
  );
  assert.equal(
    db.prepare("SELECT evidence_ref FROM agency_correspondence WHERE id=?").get("correspondence-nlsa-escalation-2026-11-26").evidence_ref,
    "gmail-message:1a21752f0d53d530"
  );
  assert.throws(
    () => db.prepare("UPDATE agency_correspondence SET summary=? WHERE id=?").run("changed", "correspondence-nlsa-escalation-2026-11-26"),
    /agency_correspondence_is_append_only/
  );
  assert.throws(
    () => db.prepare("DELETE FROM agency_correspondence WHERE id=?").run("correspondence-nlsa-escalation-2026-11-26"),
    /agency_correspondence_is_append_only/
  );

  function addEdition(id) {
    db.prepare("INSERT INTO editions (id,work_id,edition_statement,format_code) VALUES (?,?,?,?)")
      .run(id, "work-business-of-music", "Test " + id, "EPUB");
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
  assert.throws(() => insertIsbn("isbn-noncanonical", "test-noncanonical", "978-0-13-110362-7"), /isbn13_must_be_canonical/);

  addEdition("test-missing-evidence");
  assert.throws(() => insertIsbn("isbn-missing-evidence", "test-missing-evidence", "9780262033848", { evidence: "" }), /allocation_authority_publisher_and_evidence_required/);

  addEdition("test-missing-date");
  assert.throws(() => insertIsbn("isbn-missing-date", "test-missing-date", "9780201633610", { date: "" }), /verified_isbn_requires_allocation_date/);

  assert.throws(() => db.prepare("UPDATE isbn_records SET isbn13=? WHERE id=?").run("9780306406158", "isbn-valid-978"), /isbn13_checksum_invalid/);
  console.log("ISBN registry SQLite migration tests passed (14 assertions).");
} finally {
  db.close();
}
