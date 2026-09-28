#!/usr/bin/env python3
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("e2e", ROOT / "e2e.py")
e2e = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(e2e)


class E2ETests(unittest.TestCase):
    def test_manifest_gate_accepts_owned_vertical_mp4(self):
        ok, errors = e2e.manifest_ok({
            "schema": "izakhono.shorts.asset.v1",
            "route": "owned",
            "renderer": "izakhono-shorts-renderer",
            "duration_seconds": 14.0,
            "scenes": [{"index": 1}],
            "output": {"container": "mp4", "width": 1080, "height": 1920, "fps": 30},
            "policy": {"no_tracking": True, "autopublish": False},
        })
        self.assertTrue(ok)
        self.assertEqual(errors, [])

    def test_manifest_gate_rejects_external_or_wrong_dimensions(self):
        ok, errors = e2e.manifest_ok({
            "schema": "izakhono.shorts.asset.v1",
            "route": "external",
            "renderer": "izakhono-shorts-renderer",
            "duration_seconds": 14.0,
            "scenes": [{"index": 1}],
            "output": {"container": "mp4", "width": 1920, "height": 1080, "fps": 30},
            "policy": {"no_tracking": True, "autopublish": False},
        })
        self.assertFalse(ok)
        self.assertIn("manifest_route", errors)
        self.assertIn("output_dimensions", errors)

    def test_mp4_signature(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.mp4"
            p.write_bytes(b"\x00\x00\x00\x18ftypmp42" + b"0" * 5000)
            self.assertTrue(e2e.mp4_signature_ok(p))


if __name__ == "__main__":
    unittest.main()
