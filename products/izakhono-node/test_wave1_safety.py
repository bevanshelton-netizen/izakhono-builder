#!/usr/bin/env python3
import importlib.util
import pathlib
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODULE_PATH = pathlib.Path(__file__).with_name("wave1_deploy.py")
spec = importlib.util.spec_from_file_location("wave1_deploy", MODULE_PATH)
wave1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wave1)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/ok":
            body = b"ALLEGRO VIBEZ -- Africa"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/wrong":
            body = b"generic page"
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "/ok")
            self.end_headers()
            return
        if self.path == "/protected":
            self.send_response(403)
            self.end_headers()
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, fmt, *args):
        pass


class Wave1ExternalSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_identity_match_passes(self):
        result = wave1.url_probe(
            self.base + "/ok",
            expected_markers=["ALLEGRO VIBEZ", "Africa"],
        )
        self.assertTrue(result["ok"])
        self.assertEqual(result["status"], 200)

    def test_identity_mismatch_fails(self):
        result = wave1.url_probe(
            self.base + "/wrong",
            expected_markers=["ALLEGRO VIBEZ"],
        )
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], 200)
        self.assertFalse(result["identity_ok"])

    def test_redirect_is_not_public_safety(self):
        result = wave1.url_probe(
            self.base + "/redirect",
            expected_markers=["ALLEGRO VIBEZ"],
        )
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], 302)

    def test_auth_challenge_is_not_public_safety(self):
        result = wave1.url_probe(self.base + "/protected")
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], 403)


if __name__ == "__main__":
    unittest.main()
