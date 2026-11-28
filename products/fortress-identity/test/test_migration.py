from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"


class DeployAccessMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        for migration in (
            "0001_identity.sql",
            "0002_access_session_jti.sql",
            "0003_deploy_access_sessions.sql",
        ):
            self.db.executescript((MIGRATIONS / migration).read_text())

    def tearDown(self):
        self.db.close()

    def seed_parent_session(self):
        self.db.execute(
            "INSERT INTO principals (id, tenant_id, email, display_name, role, active, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("principal-1", "tenant-1", "owner@example.invalid", "Owner", "OWNER", 1, 100, 100),
        )
        self.db.execute(
            "INSERT INTO refresh_sessions (id, principal_id, token_hash, csrf_hash, access_jti, created_at, expires_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("session-1", "principal-1", "token-hash", "csrf-hash", "parent-jti", 100, 10000),
        )
        self.db.commit()

    def test_capability_row_is_bound_to_live_parent_and_resource(self):
        self.seed_parent_session()
        self.db.execute(
            "INSERT INTO deploy_access_sessions "
            "(jti, parent_access_jti, principal_id, tenant_id, application_id, environment_id, scopes_json, issued_at, expires_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("deploy-jti", "parent-jti", "principal-1", "tenant-1", "kora-network", "staging",
             '["deploy:read","deploy:write"]', 200, 500),
        )
        row = self.db.execute(
            "SELECT parent_access_jti, tenant_id, application_id, environment_id, scopes_json, revoked_at, revocation_event_id "
            "FROM deploy_access_sessions WHERE jti = ?",
            ("deploy-jti",),
        ).fetchone()
        self.assertEqual(row[:5], ("parent-jti", "tenant-1", "kora-network", "staging", '["deploy:read","deploy:write"]'))
        self.assertIsNone(row[5])
        self.assertIsNone(row[6])
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_parent_access_jti_foreign_key_rejects_orphan_capability(self):
        self.seed_parent_session()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO deploy_access_sessions "
                "(jti, parent_access_jti, principal_id, tenant_id, application_id, environment_id, scopes_json, issued_at, expires_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ("orphan-jti", "missing-parent", "principal-1", "tenant-1", "app-1", "staging", '["deploy:write"]', 200, 500),
            )

    def test_revocation_metadata_is_persisted(self):
        self.seed_parent_session()
        self.db.execute(
            "INSERT INTO deploy_access_sessions "
            "(jti, parent_access_jti, principal_id, tenant_id, application_id, environment_id, scopes_json, issued_at, expires_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("deploy-jti", "parent-jti", "principal-1", "tenant-1", "app-1", "staging", '["deploy:write"]', 200, 500),
        )
        self.db.execute(
            "UPDATE deploy_access_sessions SET revoked_at = ?, revocation_event_id = ? WHERE jti = ?",
            (250, "event-1", "deploy-jti"),
        )
        self.assertEqual(
            self.db.execute(
                "SELECT revoked_at, revocation_event_id FROM deploy_access_sessions WHERE jti = ?",
                ("deploy-jti",),
            ).fetchone(),
            (250, "event-1"),
        )


if __name__ == "__main__":
    unittest.main()
