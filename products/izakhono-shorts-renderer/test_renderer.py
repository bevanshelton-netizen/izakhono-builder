#!/usr/bin/env python3
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("renderer", ROOT / "app.py")
renderer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(renderer)


class RendererTests(unittest.TestCase):
    def setUp(self):
        renderer.CHECKPOINT = "test.safetensors"

    def sample_payload(self):
        return {
            "schema": "izakhono.shorts.render.v1",
            "job_id": "shorts_0123456789abcdef",
            "plan": {
                "schema": "izakhono.shorts.plan.v1",
                "title": "Why the moon changes shape",
                "language": "English",
                "scenes": [
                    {
                        "index": 1,
                        "duration_seconds": 7,
                        "beat": "Hook",
                        "narration": "Have you noticed the moon looks different through the month?",
                        "visual_prompt": "Original young explorer looking at the moon from a safe garden",
                        "language": "English",
                    },
                    {
                        "index": 2,
                        "duration_seconds": 7,
                        "beat": "Reveal",
                        "narration": "The moon is lit by the sun, and we see different portions as it orbits Earth.",
                        "visual_prompt": "Original educational space diagram without text or logos",
                        "language": "English",
                    },
                ],
            },
            "output": {"container": "mp4", "width": 1080, "height": 1920, "fps": 30},
            "policy": {"owned_first": True, "no_tracking": True, "originality_required": True},
        }

    def test_request_contract(self):
        job_id, plan, output = renderer.validate_request(self.sample_payload())
        self.assertEqual(job_id, "shorts_0123456789abcdef")
        self.assertEqual(len(plan["scenes"]), 2)
        self.assertEqual(output["container"], "mp4")

    def test_rejects_unowned_policy(self):
        payload = self.sample_payload()
        payload["policy"]["owned_first"] = False
        with self.assertRaisesRegex(ValueError, "owned_privacy_policy_required"):
            renderer.validate_request(payload)

    def test_text2image_workflow_is_vertical(self):
        wf = renderer.build_text2image_workflow("an original safe scene", "test")
        self.assertEqual(wf["4"]["inputs"]["width"] % 8, 0)
        self.assertEqual(wf["4"]["inputs"]["height"] % 8, 0)
        self.assertGreater(wf["4"]["inputs"]["height"], wf["4"]["inputs"]["width"])
        self.assertEqual(wf["1"]["inputs"]["ckpt_name"], "test.safetensors")

    def test_vtt_generation(self):
        payload = self.sample_payload()
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "captions.vtt"
            renderer.write_captions(payload["plan"]["scenes"], path)
            text = path.read_text(encoding="utf-8")
            self.assertIn("WEBVTT", text)
            self.assertIn("00:00:00.000 --> 00:00:07.000", text)
            self.assertIn("00:00:07.000 --> 00:00:14.000", text)

    def test_data_url_decoder(self):
        raw, mime = renderer.decode_data_url("data:audio/wav;base64,SGVsbG8=")
        self.assertEqual(raw, b"Hello")
        self.assertEqual(mime, "audio/wav")


if __name__ == "__main__":
    unittest.main()
