import unittest

from identity_verification import RegulaProvider, VerificationRequest
from regula_idv_provider import RegulaIDVProviderTransport
from regula_idv_http import RegulaIDVConfig, RegulaIDVHttpClient


class FakeClient:
    def __init__(self):
        self.started = None
        self.fetched = None
    def start_session(self, **kwargs):
        self.started = kwargs
        return {
            "url": "https://sandbox.example.test/start?sessionId=sess_123&authorization=one-time",
            "expiresAt": "2026-11-21T12:00:00Z",
        }
    def get_session(self, session_id):
        self.fetched = session_id
        return {"id": session_id, "status": 2, "properties": {}}


class RegulaProviderAdapterTests(unittest.TestCase):
    def test_provider_start_returns_session_and_one_time_handoff(self):
        client = FakeClient()
        provider = RegulaProvider(RegulaIDVProviderTransport(client))
        request = VerificationRequest(
            "entity-1", "opaque-subject", "onboarding", "ZA", "idem-secret", "notice-v1"
        )
        started = provider.start(request)
        self.assertEqual(started.provider_session_ref, "sess_123")
        self.assertIn("authorization=one-time", started.client_token)
        self.assertNotEqual(client.started["subject_ref_hash"], "opaque-subject")
        self.assertNotEqual(client.started["idempotency_key_hash"], "idem-secret")

    def test_unmapped_vendor_status_never_auto_verifies(self):
        client = FakeClient()
        provider = RegulaProvider(RegulaIDVProviderTransport(client))
        outcome = provider.retrieve("sess_123")
        self.assertEqual(client.fetched, "sess_123")
        self.assertEqual(
            (outcome.document_authenticity, outcome.document_consistency,
             outcome.face_match, outcome.liveness),
            ("indeterminate", "indeterminate", "indeterminate", "indeterminate"),
        )

    def test_cancellation_is_not_falsely_reported_as_supported(self):
        provider = RegulaProvider(RegulaIDVProviderTransport(FakeClient()))
        with self.assertRaisesRegex(RuntimeError, "cancellation_not_configured"):
            provider.cancel("sess_123")


if __name__ == "__main__":
    unittest.main()
