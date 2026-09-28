#!/usr/bin/env python3
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("speech_runtime", ROOT / "app.py")
speech = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(speech)

class SpeechRuntimeTests(unittest.TestCase):
    def test_language_normalization(self):
        self.assertEqual(speech.normalize_language("English"), "a")
        self.assertEqual(speech.normalize_language("fr-FR"), "f")
        self.assertEqual(speech.normalize_language("Portuguese"), "p")

    def test_unsupported_language_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "language_not_supported"):
            speech.normalize_language("isiZulu")

    def test_payload_contract(self):
        text, lang, voice, speed = speech.validate_payload({
            "schema": "izakhono.speech.generate.v1",
            "text": "Hello from IZAKHONO.",
            "language": "English",
            "voice": "af_heart",
            "format": "wav",
            "speed": 1.0,
        })
        self.assertEqual(text, "Hello from IZAKHONO.")
        self.assertEqual(lang, "a")
        self.assertEqual(voice, "af_heart")
        self.assertEqual(speed, 1.0)

    def test_model_cache_gate(self):
        old = speech.HF_HOME
        try:
            with tempfile.TemporaryDirectory() as d:
                speech.HF_HOME = Path(d)
                self.assertFalse(speech.model_snapshot_present())
                p = speech.model_cache_path() / "snapshots" / "abc"
                p.mkdir(parents=True)
                (p / "config.json").write_text("{}", encoding="utf-8")
                self.assertTrue(speech.model_snapshot_present())
        finally:
            speech.HF_HOME = old

if __name__ == "__main__":
    unittest.main()
