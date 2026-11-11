#!/usr/bin/env python3
import base64
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("izakhono_asr", ROOT / "app.py")
asr = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(asr)

def wav_fixture():
    return b"RIFF" + (b"\x00" * 4) + b"WAVE" + (b"\x00" * 1024)

class AsrRequestValidationTests(unittest.TestCase):
    def test_accepts_supported_south_african_language_code(self):
        audio, language = asr.validate_payload({
            "schema": "izakhono.speech.transcribe.v1",
            "audio_base64": base64.b64encode(wav_fixture()).decode("ascii"),
            "language": "af",
        })
        self.assertTrue(audio.startswith(b"RIFF"))
        self.assertEqual(language, "af")

    def test_rejects_wrong_schema(self):
        with self.assertRaisesRegex(ValueError, "invalid_schema"):
            asr.validate_payload({"schema": "wrong", "audio_base64": "AAAA"})

    def test_rejects_non_wav_audio(self):
        with self.assertRaisesRegex(ValueError, "expected_pcm_wav"):
            asr.validate_payload({
                "schema": "izakhono.speech.transcribe.v1",
                "audio_base64": base64.b64encode(b"x" * 1200).decode("ascii"),
                "language": "en",
            })

    def test_rejects_unsupported_language(self):
        with self.assertRaisesRegex(ValueError, "unsupported_language"):
            asr.validate_payload({
                "schema": "izakhono.speech.transcribe.v1",
                "audio_base64": base64.b64encode(wav_fixture()).decode("ascii"),
                "language": "xx",
            })

    def test_rejects_malformed_base64(self):
        with self.assertRaises(Exception):
            asr.validate_payload({
                "schema": "izakhono.speech.transcribe.v1",
                "audio_base64": "%%%not-base64%%%",
                "language": "en",
            })

if __name__ == "__main__":
    unittest.main()
