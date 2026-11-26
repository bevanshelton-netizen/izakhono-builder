#!/usr/bin/env python3
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "controller"))

from deployment_state import DeploymentRecord, MemoryDeploymentStore
from dns_publication_intent import (
    DnsPublicationAuthorization,
    DnsPublicationRequest,
    create_dns_publication_intent,
)


class MemoryEvents:
    def __init__(self):
        self.events = {}

    def append(self, event, event_id=None):
        identifier = event_id or "random"
        self.events.setdefault(identifier, event)
        return identifier


class DnsPublicationIntentTests(unittest.TestCase):
    def setUp(self):
        self.request = DnsPublicationRequest(
            tenant_id="tenant-a",
            zone_id="zone-1",
            zone_name="example.com",
            desired_serial=2026112601,
            approval_id="approval-1",
        )
        self.authorization = DnsPublicationAuthorization(
            allowed=True,
            authorization_id="approval-1",
            audit_event_id="fortress-audit-1",
            reason="exact-scope FORTRESS approval verified",
        )
        self.deployments = MemoryDeploymentStore()
        self.events = MemoryEvents()

    def test_authorized_request_creates_planned_intent_only(self):
        result = create_dns_publication_intent(
            self.request, self.authorization, self.deployments, self.events
        )
        record = self.deployments.get(result.deployment_id)
        self.assertEqual(result.state, "CREATED")
        self.assertEqual(result.publication, "not-published")
        self.assertEqual(record.workload, "izakhono-edge")
        self.assertEqual(record.metadata["fortress_audit_event_id"], "fortress-audit-1")
        self.assertEqual(record.metadata["desired_serial"], "2026112601")
        self.assertEqual(len(self.events.events), 1)

    def test_denied_authorization_creates_nothing(self):
        denied = DnsPublicationAuthorization(False, None, "audit-denied", "denied")
        with self.assertRaisesRegex(PermissionError, "FORTRESS denied"):
            create_dns_publication_intent(self.request, denied, self.deployments, self.events)
        self.assertEqual(self.deployments.records, {})
        self.assertEqual(self.events.events, {})

    def test_missing_audit_acknowledgement_fails_closed(self):
        incomplete = DnsPublicationAuthorization(True, "approval-1", "", "missing audit")
        with self.assertRaisesRegex(PermissionError, "audit acknowledgement"):
            create_dns_publication_intent(self.request, incomplete, self.deployments, self.events)

    def test_retries_are_idempotent(self):
        first = create_dns_publication_intent(self.request, self.authorization, self.deployments, self.events)
        second = create_dns_publication_intent(self.request, self.authorization, self.deployments, self.events)
        self.assertEqual(first.deployment_id, second.deployment_id)
        self.assertEqual(first.event_id, second.event_id)
        self.assertEqual(len(self.deployments.records), 1)
        self.assertEqual(len(self.events.events), 1)

    def test_same_deployment_id_cannot_be_rebound(self):
        result = create_dns_publication_intent(self.request, self.authorization, self.deployments, self.events)
        self.deployments.put(DeploymentRecord(result.deployment_id, "other-workload", metadata={}))
        with self.assertRaisesRegex(ValueError, "bound to different"):
            create_dns_publication_intent(self.request, self.authorization, self.deployments, self.events)

    def test_invalid_environment_is_rejected(self):
        request = DnsPublicationRequest("tenant-a", "zone-1", "example.com", 10, "approval-1", "staging")
        with self.assertRaisesRegex(ValueError, "production"):
            create_dns_publication_intent(request, self.authorization, self.deployments, self.events)


if __name__ == "__main__":
    unittest.main()
