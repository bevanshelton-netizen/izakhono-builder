import os, sqlite3, tempfile, unittest
from identity_verification import IdentityVerificationService, RegulaProvider, VerificationOutcome, VerificationRequest, VerificationStart

class FakeRegulaTransport:
    def __init__(self):
        self.available = True
        self.created = 0
        self.outcome = VerificationOutcome("passed", "passed", "passed", "passed", ("regula-evidence-1",), "2026-11-21T10:00:00+00:00")
    def health(self): return self.available
    def create_verification(self, **kwargs):
        self.created += 1
        return VerificationStart("regula-tx-1", "one-time-client-token")
    def get_verification(self, ref): return self.outcome
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
    def test_entity_isolation(self):
        session = self.service.start(self.request)
        with self.assertRaises(LookupError):
            self.service.refresh("entity-b", session["id"])
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
