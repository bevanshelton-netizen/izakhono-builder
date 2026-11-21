import os, sqlite3, tempfile, unittest
from identity_verification import IdentityVerificationService, RegulaProvider, VerificationOutcome, VerificationRequest, VerificationStart

class FakeRegulaTransport:
    def __init__(self):
        self.available = True
        self.created = 0
        self.retrieved = 0
        self.on_retrieve = None
        self.outcome = VerificationOutcome("passed", "passed", "passed", "passed", ("regula-evidence-1",), "2026-11-21T10:00:00+00:00")
    def health(self): return self.available
    def create_verification(self, **kwargs):
        self.created += 1
        return VerificationStart("regula-tx-1", "one-time-client-token")
    def get_verification(self, ref):
        self.retrieved += 1
        if self.on_retrieve:
            self.on_retrieve()
        return self.outcome
    def cancel_verification(self, ref): return None

class IdentityVerificationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmp.name, "identity.db")
        with sqlite3.connect(self.db_path) as db:
            db.execute("CREATE TABLE entities(id TEXT PRIMARY KEY, status TEXT NOT NULL)")
            db.execute("INSERT INTO entities VALUES('entity-a','active')")
            db.execute("INSERT INTO entities VALUES('entity-b','active')")
            db.execute("""CREATE TABLE audit_events(
                id TEXT PRIMARY KEY,event_type TEXT NOT NULL,entity_id TEXT,user_id TEXT,
                subject_hash TEXT,detail TEXT,created_at TEXT NOT NULL)""")
        self.transport = FakeRegulaTransport()
        self.provider = RegulaProvider(self.transport)
        self.service = IdentityVerificationService(self.db_path, [self.provider])
        self.service.initialize()
        self.request = VerificationRequest("entity-a", "opaque-subject-001", "customer_onboarding",
                                           "ZA", "idem-001", "privacy-v1")
    def tearDown(self): self.tmp.cleanup()
    def test_start_and_idempotency(self):
        first = self.service.start(self.request)
        second = self.service.start(self.request)
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(self.transport.created, 1)
        self.assertEqual(first["status"], "in_progress")
        self.assertNotIn("client_token", second)
    def test_only_complete_pass_can_verify(self):
        session = self.service.start(self.request)
        result = self.service.refresh("entity-a", session["id"])
        self.assertEqual(result["status"], "verified")
    def test_ambiguous_check_requires_review(self):
        session = self.service.start(self.request)
        self.transport.outcome = VerificationOutcome("passed", "passed", "passed", "indeterminate")
        result = self.service.refresh("entity-a", session["id"])
        self.assertEqual(result["status"], "review_required")
    def test_wholly_indeterminate_provider_result_remains_pollable(self):
        session = self.service.start(self.request)
        self.transport.outcome = VerificationOutcome(
            "indeterminate", "indeterminate", "indeterminate", "indeterminate"
        )
        first = self.service.refresh("entity-a", session["id"])
        second = self.service.refresh("entity-a", session["id"])
        self.assertEqual(first["status"], "in_progress")
        self.assertEqual(second["status"], "in_progress")

    def test_entity_isolation(self):
        session = self.service.start(self.request)
        with self.assertRaises(LookupError):
            self.service.refresh("entity-b", session["id"])
    def test_expired_session_is_closed_without_provider_poll(self):
        session = self.service.start(self.request)
        with sqlite3.connect(self.db_path) as db:
            db.execute(
                "UPDATE identity_verification_sessions SET expires_at=? WHERE id=?",
                ("2020-01-01T00:00:00+00:00", session["id"]),
            )
        result = self.service.refresh("entity-a", session["id"])
        self.assertEqual(result["status"], "incomplete")
        self.assertIsNotNone(result["completed_at"])
        self.assertEqual(self.transport.retrieved, 0)

    def test_malformed_expiry_fails_closed_without_provider_poll(self):
        session = self.service.start(self.request)
        with sqlite3.connect(self.db_path) as db:
            db.execute(
                "UPDATE identity_verification_sessions SET expires_at=? WHERE id=?",
                ("not-a-timestamp", session["id"]),
            )
        result = self.service.refresh("entity-a", session["id"])
        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(self.transport.retrieved, 0)

    def test_provider_result_cannot_overwrite_concurrent_cancellation(self):
        session = self.service.start(self.request)

        def cancel_during_poll():
            with sqlite3.connect(self.db_path) as db:
                db.execute(
                    "UPDATE identity_verification_sessions SET status='cancelled' WHERE id=?",
                    (session["id"],),
                )

        self.transport.on_retrieve = cancel_during_poll
        result = self.service.refresh("entity-a", session["id"])
        self.assertEqual(result["status"], "cancelled")
        self.assertIsNone(result["outcome_json"])
        with sqlite3.connect(self.db_path) as db:
            events = db.execute(
                "SELECT COUNT(*) FROM audit_events WHERE event_type='identity_verification.result_recorded'"
            ).fetchone()[0]
        self.assertEqual(events, 0)

    def test_provider_result_cannot_overwrite_session_expired_during_poll(self):
        session = self.service.start(self.request)

        def expire_during_poll():
            with sqlite3.connect(self.db_path) as db:
                db.execute(
                    "UPDATE identity_verification_sessions SET expires_at=? WHERE id=?",
                    ("2020-01-01T00:00:00+00:00", session["id"]),
                )

        self.transport.on_retrieve = expire_during_poll
        result = self.service.refresh("entity-a", session["id"])
        self.assertEqual(result["status"], "incomplete")
        self.assertIsNone(result["outcome_json"])
    def test_provider_unavailable_fails_closed(self):
        self.transport.available = False
        request = VerificationRequest("entity-a", "opaque-subject-002", "customer_onboarding",
                                      "ZA", "idem-002", "privacy-v1")
        with self.assertRaisesRegex(RuntimeError, "provider_unavailable"):
            self.service.start(request)
        self.transport.available = True
        recovered = self.service.start(request)
        self.assertEqual(recovered["status"], "in_progress")
        self.assertEqual(self.transport.created, 1)

if __name__ == "__main__":
    unittest.main()
