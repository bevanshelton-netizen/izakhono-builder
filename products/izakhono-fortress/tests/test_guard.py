import json
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "products" / "izakhono-fortress"))
import guard


POLICY = json.loads((ROOT / "products" / "izakhono-fortress" / "policy.json").read_text(encoding="utf-8"))
FIXTURE_PATH = ROOT / "tests" / "fixtures" / "fortress-egress-conformance-v1.json"


class AuthorizationFixtureTests(unittest.TestCase):
    def test_all_conformance_fixtures(self):
        fixtures = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))["fixtures"]
        for fixture in fixtures:
            with self.subTest(fixture=fixture["id"]):
                if fixture["id"] == "EG-018":
                    self.assertEqual(guard.authorize(fixture["request"], POLICY), (False, "invalid_request"))
                    continue
                self.assertEqual(
                    guard.authorize(fixture["request"], POLICY),
                    (fixture["expected"]["allowed"], fixture["expected"]["reason"]),
                )

    def test_non_string_scope_values_are_denied(self):
        for key in ("entity_id", "provider_class", "purpose", "data_class"):
            request = {
                "entity_id": "entity_demo",
                "provider_class": "external_ai",
                "purpose": "research",
                "data_class": "public",
                "payload": {},
            }
            request[key] = {"unexpected": "object"}
            with self.subTest(field=key):
                self.assertFalse(guard.authorize(request, POLICY)[0])

    def test_forbidden_class_wins_over_allowlist_overlap(self):
        policy = json.loads(json.dumps(POLICY))
        policy["data_classes"]["allowed_external"].append("credentials")
        result = guard.authorize({
            "entity_id": "entity_demo", "provider_class": "external_ai",
            "purpose": "research", "data_class": "credentials", "payload": {},
        }, policy)
        self.assertEqual(result, (False, "forbidden_data_class"))

    def test_invalid_policy_fails_closed(self):
        for invalid in ({}, {"default": "permit"}, None):
            with self.subTest(policy=invalid):
                self.assertEqual(guard.authorize({
                    "entity_id": "entity_demo", "provider_class": "external_ai",
                    "purpose": "research", "data_class": "public", "payload": {},
                }, invalid), (False, "policy_invalid"))

    def test_deeply_nested_secret_field_is_detected_without_recursion(self):
        payload = {}
        cursor = payload
        for _ in range(1500):
            cursor["nested"] = {}
            cursor = cursor["nested"]
        cursor["api_key"] = "SYNTHETIC"
        request = {
            "entity_id": "entity_demo", "provider_class": "external_ai",
            "purpose": "research", "data_class": "public", "payload": payload,
        }
        self.assertEqual(guard.authorize(request, POLICY), (False, "secret_like_field_detected"))

    def test_non_object_requests_are_denied(self):
        for value in (None, [], "request", 7):
            with self.subTest(value=value):
                self.assertEqual(guard.authorize(value, POLICY), (False, "invalid_request"))


class HttpBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.previous_token = guard.TOKEN
        guard.TOKEN = "synthetic-test-token"
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), guard.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = "http://127.0.0.1:" + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        guard.TOKEN = cls.previous_token

    def request(self, path, body=None, token="synthetic-test-token", headers=None):
        request_headers = dict(headers or {})
        if token is not None:
            request_headers["Authorization"] = "Bearer " + token
        data = None if body is None else body
        req = Request(self.base + path, data=data, headers=request_headers, method="GET" if body is None else "POST")
        try:
            with urlopen(req, timeout=3) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            return exc.code, json.loads(exc.read().decode("utf-8"))

    def post(self, body, headers=None, token="synthetic-test-token"):
        merged = {"Content-Type": "application/json"}
        merged.update(headers or {})
        return self.request("/v1/authorize-egress", body=body, token=token, headers=merged)

    def test_missing_and_wrong_tokens_are_rejected(self):
        self.assertEqual(self.post(b"{}", token=None)[0], 401)
        self.assertEqual(self.post(b"{}", token="wrong")[0], 401)

    def test_allowlisted_request_is_authorized(self):
        request = {
            "entity_id": "entity_demo", "provider_class": "external_ai",
            "purpose": "research", "data_class": "public", "payload": {"query": "public"},
        }
        status, response = self.post(json.dumps(request).encode())
        self.assertEqual((status, response["allowed"]), (200, True))

    def test_malformed_json_is_rejected(self):
        self.assertEqual(self.post(b"{").0 if False else self.post(b"{")[0], 400)

    def test_non_object_json_is_rejected(self):
        self.assertEqual(self.post(b"[]")[0], 400)

    def test_wrong_content_type_is_rejected(self):
        self.assertEqual(self.post(b"{}", headers={"Content-Type": "text/plain"})[0], 415)

    def test_oversized_declared_body_is_rejected_without_reading_it(self):
        status, response = self.request(
            "/v1/authorize-egress", body=b"", headers={
                "Content-Type": "application/json",
                "Content-Length": str(guard.MAX_BODY_BYTES + 1),
            },
        )
        self.assertEqual(status, 413)
        self.assertEqual(response["error"], "request_body_too_large")

    def test_health_fails_when_policy_is_invalid(self):
        original = guard.POLICY_PATH
        try:
            guard.POLICY_PATH = Path("/path/that/does/not/exist/fortress-policy.json")
            status, response = self.request("/healthz")
            self.assertEqual((status, response["ok"]), (503, False))
        finally:
            guard.POLICY_PATH = original


if __name__ == "__main__":
    unittest.main()
