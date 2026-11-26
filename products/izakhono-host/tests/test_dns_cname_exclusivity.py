#!/usr/bin/env python3
"""SQLite contract tests for the owned DNS authority invariants."""
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"


class DnsCnameExclusivityTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript((MIGRATIONS / "0003_dns_authority.sql").read_text())
        self.db.executescript((MIGRATIONS / "0004_dns_cname_exclusivity.sql").read_text())
        self.db.execute(
            """INSERT INTO dns_zones
               (id,customer_id,zone_name,status,serial,primary_nameserver,secondary_nameserver,created_at,updated_at)
               VALUES ('z1','c1','example.com','planned',1,'ns1.example.net','ns2.example.net',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"""
        )

    def tearDown(self):
        self.db.close()

    def insert_record(self, record_id, name, record_type, enabled=1):
        self.db.execute(
            """INSERT INTO dns_records
               (id,zone_id,name,type,ttl,value,enabled,created_at,updated_at)
               VALUES (?, 'z1', ?, ?, 300, 'target.example.net.', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (record_id, name, record_type, enabled),
        )

    def test_cname_cannot_be_added_after_address_record(self):
        self.insert_record("r1", "www", "A")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "CNAME cannot coexist"):
            self.insert_record("r2", "www", "CNAME")

    def test_address_record_cannot_be_added_after_cname(self):
        self.insert_record("r1", "www", "CNAME")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "CNAME cannot coexist"):
            self.insert_record("r2", "www", "AAAA")

    def test_different_names_can_have_cname_and_address_records(self):
        self.insert_record("r1", "www", "CNAME")
        self.insert_record("r2", "api", "A")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM dns_records").fetchone()[0], 2)

    def test_disabled_records_do_not_block_active_cname(self):
        self.insert_record("r1", "www", "A", enabled=0)
        self.insert_record("r2", "www", "CNAME", enabled=1)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM dns_records").fetchone()[0], 2)

    def test_update_cannot_create_cname_conflict(self):
        self.insert_record("r1", "www", "CNAME")
        self.insert_record("r2", "api", "A")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "CNAME cannot coexist"):
            self.db.execute("UPDATE dns_records SET name='www' WHERE id='r2'")


if __name__ == "__main__":
    unittest.main()
