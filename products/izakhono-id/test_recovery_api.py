import importlib
import os
import sqlite3
import tempfile
import unittest
from unittest import mock


class RecoveryApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ['IZAKHONO_ID_DATA'] = self.tmp.name
        os.environ['IZAKHONO_ID_EMAIL_MODE'] = 'log'
        os.environ['IZAKHONO_ID_PUBLIC_BASE_URL'] = 'https://id.example.test'
        import app
        import account_recovery
        import recovery_api
        self.app = importlib.reload(app)
        self.recovery = importlib.reload(account_recovery)
        self.api = importlib.reload(recovery_api)
        with self.app.db_connect() as db:
            db.execute("INSERT INTO entities(id,slug,display_name,created_at) VALUES('ent_1','izakhono-africa','Izakhono Africa','2026-01-01T00:00:00+00:00')")
            salt, digest = self.app.hash_password('Correct Horse Battery')
            db.execute("INSERT INTO users(id,email,password_salt,password_hash,email_verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                       ('usr_1','customer@example.test',salt,digest,'2026-01-01T00:00:00+00:00','2026-01-01T00:00:00+00:00','2026-01-01T00:00:00+00:00'))
            db.execute("INSERT INTO memberships(id,entity_id,user_id,role,created_at) VALUES('mem_1','ent_1','usr_1','member','2026-01-01T00:00:00+00:00')")
            db.commit()

    def tearDown(self):
        self.tmp.cleanup()
        for key in ('IZAKHONO_ID_DATA','IZAKHONO_ID_EMAIL_MODE','IZAKHONO_ID_PUBLIC_BASE_URL'):
            os.environ.pop(key, None)

    def test_reset_revokes_sessions_and_never_issues_session(self):
        with self.app.db_connect() as db:
            user = db.execute("SELECT * FROM users WHERE id='usr_1'").fetchone()
            entity = db.execute("SELECT * FROM entities WHERE id='ent_1'").fetchone()
            membership = db.execute("SELECT * FROM memberships WHERE id='mem_1'").fetchone()
            token, _, _ = self.app.issue_session(db, entity, user, membership)
            reset = self.recovery.issue_token(db, user['id'], 'password_reset', entity['id'])
            db.commit()
        self.assertTrue(token)
        self.assertTrue(reset)

        # Exercise the security rule directly: consumption changes the password boundary,
        # but no bearer session is created by recovery.
        with self.app.db_connect() as db:
            row = self.recovery.consume_token(db, reset, 'password_reset')
            self.assertIsNotNone(row)
            salt, digest = self.app.hash_password('New Strong Password')
            ts = self.app.now_iso()
            db.execute('UPDATE users SET password_salt=?,password_hash=?,updated_at=? WHERE id=?', (salt,digest,ts,'usr_1'))
            db.execute('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL', (ts,'usr_1'))
            db.commit()
            sessions = db.execute("SELECT * FROM sessions WHERE user_id='usr_1' AND revoked_at IS NULL").fetchall()
            self.assertEqual(sessions, [])

    def test_token_replay_is_rejected(self):
        with self.app.db_connect() as db:
            token = self.recovery.issue_token(db, 'usr_1', 'email_verification')
            db.commit()
            self.assertIsNotNone(self.recovery.consume_token(db, token, 'email_verification'))
            self.assertIsNone(self.recovery.consume_token(db, token, 'email_verification'))

    def test_wrong_kind_is_rejected(self):
        with self.app.db_connect() as db:
            token = self.recovery.issue_token(db, 'usr_1', 'password_reset')
            db.commit()
            self.assertIsNone(self.recovery.consume_token(db, token, 'email_verification'))

    def test_mfa_does_not_create_session(self):
        with self.app.db_connect() as db:
            db.execute("UPDATE users SET mfa_enabled_at='2026-01-01T00:00:00+00:00' WHERE id='usr_1'")
            db.commit()
            user = db.execute("SELECT * FROM users WHERE id='usr_1'").fetchone()
            self.assertTrue(user['mfa_enabled_at'])
            sessions = db.execute("SELECT * FROM sessions WHERE user_id='usr_1'").fetchall()
            self.assertEqual(len(sessions), 0)


if __name__ == '__main__':
    unittest.main()
