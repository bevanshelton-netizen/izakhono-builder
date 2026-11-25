import unittest
from datetime import datetime, timedelta, timezone

from identity import IdentityBoundaryError, authorised_experience_store


def active_claims(**overrides):
    value = {
        "ok": True,
        "active": True,
        "subject": "member@example.test",
        "entity_id": "entity-from-id-session",
        "entity_slug": "entity-a",
        "role": "operator",
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
    }
    value.update(overrides)
    return value


class IdentityBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.introspect = lambda token: active_claims()
        self.allow = lambda request: True

    def test_identity_scope_is_used_not_client_scope(self):
        store, actor = authorised_experience_store(
            ":memory:", bearer_token="opaque-session", permission="experience:survey:read",
            introspect=self.introspect, fortress_decide=self.allow,
        )
        self.assertEqual(store.entity_id, "entity-from-id-session")
        self.assertEqual(store.platform_id, "izakhono-experience")
        self.assertEqual(actor["subject"], "member@example.test")

    def test_inactive_session_denied(self):
        with self.assertRaises(IdentityBoundaryError):
            authorised_experience_store(
                ":memory:", bearer_token="session", permission="experience:survey:read",
                introspect=lambda token: active_claims(active=False), fortress_decide=self.allow,
            )

    def test_expired_or_missing_expiry_denied(self):
        for expiry in (None, (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()):
            with self.subTest(expiry=expiry), self.assertRaises(IdentityBoundaryError):
                authorised_experience_store(
                    ":memory:", bearer_token="session", permission="experience:survey:read",
                    introspect=lambda token, expiry=expiry: active_claims(expires_at=expiry),
                    fortress_decide=self.allow,
                )

    def test_missing_identity_adapter_denied(self):
        with self.assertRaises(IdentityBoundaryError):
            authorised_experience_store(
                ":memory:", bearer_token="session", permission="experience:survey:read",
                introspect=None, fortress_decide=self.allow,
            )

    def test_missing_fortress_adapter_denied(self):
        with self.assertRaises(IdentityBoundaryError):
            authorised_experience_store(
                ":memory:", bearer_token="session", permission="experience:survey:read",
                introspect=self.introspect, fortress_decide=None,
            )

    def test_fortress_explicit_deny_and_indeterminate_deny(self):
        for decision in (False, None, "allow"):
            with self.subTest(decision=decision), self.assertRaises(IdentityBoundaryError):
                authorised_experience_store(
                    ":memory:", bearer_token="session", permission="experience:survey:read",
                    introspect=self.introspect, fortress_decide=lambda request, d=decision: d,
                )

    def test_fortress_failure_denies(self):
        def unavailable(request):
            raise RuntimeError("policy service unavailable")
        with self.assertRaises(IdentityBoundaryError):
            authorised_experience_store(
                ":memory:", bearer_token="session", permission="experience:survey:read",
                introspect=self.introspect, fortress_decide=unavailable,
            )

    def test_identity_failure_denies(self):
        def unavailable(token):
            raise RuntimeError("identity service unavailable")
        with self.assertRaises(IdentityBoundaryError):
            authorised_experience_store(
                ":memory:", bearer_token="session", permission="experience:survey:read",
                introspect=unavailable, fortress_decide=self.allow,
            )

    def test_invalid_bearer_or_permission_denied(self):
        for token, permission in (("", "experience:survey:read"), ("session", "")):
            with self.subTest(token=token, permission=permission), self.assertRaises(IdentityBoundaryError):
                authorised_experience_store(
                    ":memory:", bearer_token=token, permission=permission,
                    introspect=self.introspect, fortress_decide=self.allow,
                )


if __name__ == "__main__":
    unittest.main()
