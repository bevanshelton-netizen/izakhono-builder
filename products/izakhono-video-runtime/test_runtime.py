#!/usr/bin/env python3
import base64
import importlib.util
import io
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("video_runtime", ROOT / "app.py")
video = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(video)

class FakeImage:
    width=576
    height=1024

class VideoRuntimeTests(unittest.TestCase):
    def test_fit_dimensions_preserves_vertical_shape(self):
        w,h = video.fit_dimensions(576,1024,480*832,16)
        self.assertGreater(h,w)
        self.assertEqual(w % 16,0)
        self.assertEqual(h % 16,0)
        self.assertLessEqual(w*h,480*832 + 20000)

    def test_invalid_policy_fails_closed(self):
        with self.assertRaisesRegex(ValueError,"owned_privacy_originality"):
            video.validate_payload({
                "schema":"izakhono.video.scene.v1",
                "prompt":"original scene",
                "source_image":"bad",
                "policy":{"owned_first":False},
            })

    def test_model_gate_requires_model_index(self):
        old=video.MODEL_DIR
        import tempfile
        try:
            with tempfile.TemporaryDirectory() as d:
                video.MODEL_DIR=Path(d)
                self.assertFalse(video.model_ready())
                (video.MODEL_DIR/"model_index.json").write_text("{}",encoding="utf-8")
                self.assertTrue(video.model_ready())
        finally:
            video.MODEL_DIR=old

if __name__=="__main__":
    unittest.main()
