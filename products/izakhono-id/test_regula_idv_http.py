import json
import unittest
from unittest.mock import patch

from regula_idv_http import (
    RegulaAPIError,
    RegulaConfigurationError,
    RegulaIDVConfig,
    RegulaIDVHttpClient,
)


class Response:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode()
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self, limit):
        return self.payload


class RegulaIDVHttpTests(unittest.TestCase):
    def config(self):
        return RegulaIDVConfig(
            "https://sandbox.example.test", "test-secret", "workflow-123"
        )

    @patch("regula_idv_http.urllib.request.urlopen")
    def test_start_uses_server_side_token_url_contract(self, open_url):
        open_url.return_value = Response({
            "url": "https://sandbox.example.test/mobile?authorization=Token%20abc&sessionId=sess_1",
            "expiresAt": "2026-11-21T12:00:00Z",
            "workflowIds": ["workflow-123"],
        })
        client = RegulaIDVHttpClient(self.config())
        result = client.start_session(
            entity_ref="entity-1",
            subject_ref_hash="a" * 64,
            purpose="customer_onboarding",
            jurisdiction="ZA",
            notice_version="2026-01",
        )
        self.assertIn("sessionId=sess_1", result["url"])
        request = open_url.call_args.args[0]
        self.assertEqual(request.get_method(), "POST")
        self.assertIn("/api/v1/deeplink?workflowId=workflow-123", request.full_url)
        self.assertEqual(request.get_header("Authorization"), "ApiKey test-secret")

    @patch("regula_idv_http.urllib.request.urlopen")
    def test_rejects_handoff_url_on_other_origin(self, open_url):
        open_url.return_value = Response({
            "url": "https://attacker.example/mobile?authorization=Token%20abc",
            "expiresAt": "2026-11-21T12:00:00Z",
        })
        client = RegulaIDVHttpClient(self.config())
        with self.assertRaises(RegulaAPIError):
            client.start_session(
                entity_ref="entity-1", subject_ref_hash="a" * 64,
                purpose="onboarding", jurisdiction="ZA", notice_version="v1",
            )

    @patch("regula_idv_http.urllib.request.urlopen")
    def test_fetches_session_without_interpreting_status(self, open_url):
        open_url.return_value = Response({"id": "sess_1", "status": 2, "properties": {}})
        result = RegulaIDVHttpClient(self.config()).get_session("sess_1")
        self.assertEqual(result["status"], 2)
        self.assertEqual(open_url.call_args.args[0].get_method(), "GET")

    def test_rejects_invalid_session_identifier(self):
        with self.assertRaises(ValueError):
            RegulaIDVHttpClient(self.config()).get_session("../other")

    def test_configuration_requires_https_and_workflow(self):
        with self.assertRaises(RegulaConfigurationError):
            RegulaIDVConfig.from_env()


if __name__ == "__main__":
    unittest.main()
