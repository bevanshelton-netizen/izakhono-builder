"""Tests for supplier-neutral read-only discovery adapters and contracts."""
from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

VALIDATE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VALIDATE_DIR))

from provider_discovery import (  # noqa: E402
    FixtureProviderAdapter,
    combine_discovery,
    validate_discovery,
)


class ProviderDiscoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = VALIDATE_DIR / "fixtures/providers/synthetic-provider-discovery.json"
        with cls.fixture.open("r", encoding="utf-8") as handle:
            cls.document = json.load(handle)

    def test_fixture_satisfies_discovery_contract(self):
        self.assertEqual(validate_discovery(self.document), [])

    def test_fixture_adapter_exposes_only_read_methods(self):
        adapter = FixtureProviderAdapter(self.fixture)
        self.assertEqual(adapter.provider_id, "synthetic-provider")
        self.assertEqual(adapter.adapter_version, "0.1.0")
        self.assertEqual(adapter.discover_capabilities()["readOnly"], True)
        self.assertEqual(len(adapter.list_resources()), 1)
        self.assertFalse(hasattr(adapter, "create_resource"))
        self.assertFalse(hasattr(adapter, "delete_resource"))
        self.assertFalse(hasattr(adapter, "execute"))

    def test_unknown_mail_and_network_claims_remain_unknown(self):
        network = self.document["capabilities"]["network"]
        mail = self.document["capabilities"]["mail"]
        self.assertEqual(network["reverseDnsControl"]["evidenceStatus"], "unknown")
        self.assertIsNone(network["reverseDnsControl"]["value"])
        self.assertEqual(mail["selfHostedMailPermitted"]["evidenceStatus"], "unknown")
        self.assertIsNone(mail["selfHostedMailPermitted"]["value"])

    def test_supplier_claim_is_not_relabelled_as_verified(self):
        candidate = copy.deepcopy(self.document)
        candidate["capabilities"]["mail"]["smtpPort25"] = {
            "value": True,
            "evidenceStatus": "supplier-claimed",
            "evidenceReference": "test:written-claim-001",
        }
        self.assertEqual(validate_discovery(candidate), [])
        self.assertEqual(
            candidate["capabilities"]["mail"]["smtpPort25"]["evidenceStatus"],
            "supplier-claimed",
        )

    def test_invalid_read_only_flag_is_rejected(self):
        candidate = copy.deepcopy(self.document)
        candidate["readOnly"] = False
        self.assertTrue(any("readOnly" in error for error in validate_discovery(candidate)))

    def test_missing_evidence_status_is_rejected(self):
        candidate = copy.deepcopy(self.document)
        del candidate["capabilities"]["network"]["staticIPv4"]["evidenceStatus"]
        self.assertTrue(validate_discovery(candidate))

    def test_combiner_does_not_approve_unknown_resource(self):
        adapter = FixtureProviderAdapter(self.fixture)
        combined = combine_discovery(
            adapter.discover_capabilities(), adapter.list_resources()
        )
        self.assertEqual(combined["resources"][0]["state"], "unknown")
        self.assertTrue(combined["readOnly"])
        self.assertEqual(validate_discovery(combined), [])

    def test_fixture_adapter_reads_local_file_only(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.json"
            path.write_text(json.dumps(self.document), encoding="utf-8")
            adapter = FixtureProviderAdapter(path)
            self.assertEqual(adapter.list_resources(), self.document["resources"])


if __name__ == "__main__":
    unittest.main()
