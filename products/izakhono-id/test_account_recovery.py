import os
import sqlite3
import tempfile
import unittest

from account_recovery import consume_token, issue_token, migrate, record_request, token_hash


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        migrate(self.db)

    def tearDown(self):
        self.db.close()

    def test_only_hash_is_persisted_and_token_is_single_use(self):
        token = issue_token(self.db, "usr_1", "password_reset")
        row = self.db.execute("SELECT token_hash FROM account_tokens").fetchone()
        self.assertEqual(row["token_hash"], token_hash(token))
        self.assertNotEqual(row["token_hash"], token)
        self.db.commit()
        first = consume_token(self.db, token, "password_reset")
        self.assertIsNotNone(first)
        self.db.commit()
        self.assertIsNone(consume_token(self.db, token, "password_reset"))

    def test_wrong_kind_cannot_consume_token(self):
        token = issue_token(self.db, "usr_1", "email_verification")
        self.assertIsNone(consume_token(self.db, token, "password_reset"))

    def test_request_throttle_is_bounded(self):
        allowed = [record_request(self.db, "fp", "password_reset") for _ in range(7)]
        self.assertEqual(allowed[:5], [True] * 5)
        self.assertEqual(allowed[5:], [False, False])

    def test_expired_token_rejected(self):
        token = issue_token(self.db, "usr_1", "password_reset", seconds=60)
        self.db.execute("UPDATE account_tokens SET expires_at=0 WHERE token_hash=?", (token_hash(token),))
        self.db.commit()
        self.assertIsNone(consume_token(self.db, token, "password_reset"))


if __name__ == "__main__":
    unittest.main()
