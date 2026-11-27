from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = [
    ROOT / "migrations/0032_topic_pdf_generation_jobs.sql",
    ROOT / "migrations/0033_topic_pdf_job_execution_and_reviews.sql",
    ROOT / "migrations/0034_topic_pdf_idempotency_and_specialist_evidence.sql",
    ROOT / "migrations/0035_topic_pdf_render_storage.sql",
    ROOT / "migrations/0036_topic_pdf_customer_auth_limits.sql",
    ROOT / "migrations/0037_topic_pdf_customer_fulfilment.sql",
]


class TopicPdfMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.execute("CREATE TABLE builder_customers (id TEXT PRIMARY KEY)")
        for migration in MIGRATIONS:
            self.db.executescript(migration.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def test_migrations_apply_and_expected_columns_exist(self):
        job_columns = {row[1] for row in self.db.execute("PRAGMA table_info(topic_pdf_generation_jobs)")}
        self.assertTrue({
            "attempt_count", "next_attempt_at", "lease_until", "last_error",
            "manuscript_json", "research_json", "idempotency_key",
            "pdf_storage_key", "pdf_sha256", "pdf_bytes", "render_attempt_count",
        }.issubset(job_columns))
        review_columns = {row[1] for row in self.db.execute("PRAGMA table_info(topic_pdf_review_decisions)")}
        self.assertTrue({"specialist_reviewer_name", "specialist_credentials", "specialist_reviewed_at"}.issubset(review_columns))
        self.assertIsNotNone(self.db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='topic_pdf_auth_rate_limits'").fetchone())
        entitlement_columns = {row[1] for row in self.db.execute("PRAGMA table_info(topic_pdf_customer_entitlements)")}
        self.assertTrue({"customer_id", "publication_id", "payment_reference", "status", "purchased_at"}.issubset(entitlement_columns))
        self.assertIsNotNone(self.db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='topic_pdf_download_events'").fetchone())

    def test_customer_idempotency_key_is_unique(self):
        values = ("job_1", "{}", "{}", "requested", "standard", "customer_1", "fingerprint_1", "request-key-0001")
        self.db.execute(
            "INSERT INTO topic_pdf_generation_jobs(id,request_json,plan_json,status,risk_level,requested_by,request_fingerprint,idempotency_key) VALUES(?,?,?,?,?,?,?,?)",
            values,
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO topic_pdf_generation_jobs(id,request_json,plan_json,status,risk_level,requested_by,request_fingerprint,idempotency_key) VALUES(?,?,?,?,?,?,?,?)",
                ("job_2", "{}", "{}", "requested", "standard", "customer_1", "fingerprint_2", "request-key-0001"),
            )

    def test_audit_and_review_records_reference_jobs(self):
        self.db.execute(
            "INSERT INTO topic_pdf_generation_jobs(id,request_json,plan_json,status,risk_level,request_fingerprint) VALUES('job_3','{}','{}','quality_review','standard','fingerprint_3')"
        )
        self.db.execute(
            "INSERT INTO topic_pdf_generation_events(id,job_id,event_type,actor,detail_json) VALUES('event_3','job_3','draft.generated','worker','{}')"
        )
        self.db.execute(
            "INSERT INTO topic_pdf_review_decisions(id,job_id,reviewer_name,reviewer_role,decision,rights_reviewed,factual_review_passed,specialist_review_passed,editorial_approved,specialist_reviewer_name,specialist_credentials) VALUES('review_3','job_3','Editor','Publisher','approved',1,1,0,1,NULL,NULL)"
        )
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM topic_pdf_generation_events WHERE job_id='job_3'").fetchone()[0], 1)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM topic_pdf_review_decisions WHERE job_id='job_3'").fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main()
