from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[3]
migration = ROOT / "migrations" / "0032_worknow_connector_core.sql"
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
db.executescript(migration.read_text(encoding="utf-8"))

db.execute("INSERT INTO worknow_employers(id,tenant_id,legal_name,registration_number,country_code,verification_status,verified_by,verified_at) VALUES(?,?,?,?,?,?,?,?)",
           ("e1","t1","Example Pty Ltd","REG-1","ZA","verified","reviewer","2026-11-28T08:00:00Z"))
db.execute("INSERT INTO worknow_employer_memberships(id,tenant_id,employer_id,user_id,role) VALUES(?,?,?,?,?)",
           ("m1","t1","e1","user1","owner"))
db.execute("INSERT INTO worknow_vacancies(id,tenant_id,employer_id,title,description,country_code,status,created_by) VALUES(?,?,?,?,?,?,?,?)",
           ("v1","t1","e1","Analyst","Description","ZA","published","user1"))
db.execute("INSERT INTO worknow_applications(id,tenant_id,vacancy_id,employer_id,applicant_subject_id,direct_employer_consent,privacy_notice_version,consented_at,submitted_at) VALUES(?,?,?,?,?,?,?,?,?)",
           ("a1","t1","v1","e1","candidate1",1,"notice-v1","2026-11-28T08:01:00Z","2026-11-28T08:02:00Z"))
assert db.execute("SELECT count(*) FROM worknow_applications").fetchone()[0] == 1

# Cross-tenant references cannot be linked through composite foreign keys.
try:
    db.execute("INSERT INTO worknow_vacancies(id,tenant_id,employer_id,title,description,country_code,status,created_by) VALUES(?,?,?,?,?,?,?,?)",
               ("v2","tenant-other","e1","Bad tenant","Description","ZA","draft","user2"))
    raise AssertionError("cross-tenant employer reference unexpectedly accepted")
except sqlite3.IntegrityError:
    pass

# Consent is a database-level invariant.
try:
    db.execute("INSERT INTO worknow_applications(id,tenant_id,vacancy_id,employer_id,applicant_subject_id,direct_employer_consent,privacy_notice_version,consented_at,submitted_at) VALUES(?,?,?,?,?,?,?,?,?)",
               ("a2","t1","v1","e1","candidate2",0,"notice-v1","2026-11-28T08:01:00Z","2026-11-28T08:02:00Z"))
    raise AssertionError("application without direct-employer consent unexpectedly accepted")
except sqlite3.IntegrityError:
    pass

db.execute("INSERT INTO worknow_audit_events(id,tenant_id,actor_subject_id,action,resource_type,resource_id,outcome,event_time,request_id) VALUES(?,?,?,?,?,?,?,?,?)",
           ("audit1","t1","user1","vacancy.publish","vacancy","v1","success","2026-11-28T08:03:00Z","req1"))
try:
    db.execute("UPDATE worknow_audit_events SET action='tampered' WHERE id='audit1'")
    raise AssertionError("audit event update unexpectedly accepted")
except sqlite3.IntegrityError:
    pass
print("WORKNOW SQL migration: schema and safety constraints passed")
