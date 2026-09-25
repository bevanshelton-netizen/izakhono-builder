#!/usr/bin/env python3
import base64
import importlib.util
import os
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent
os.environ.setdefault("IZAKHONO_MEDIA_INTERNAL_KEY", "unit-test-key")
spec = importlib.util.spec_from_file_location("media_runtime", ROOT / "app.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class RuntimeContractTests(unittest.TestCase):
    def test_modes_exist(self):
        self.assertIn("starter_campaign", mod.MODE_SPECS)
        self.assertIn("campaign", mod.MODE_SPECS)
        self.assertIn("360view", mod.MODE_SPECS)

    def test_data_url_validation(self):
        raw=b"fake-image-bytes"
        value="data:image/png;base64,"+base64.b64encode(raw).decode()
        decoded,mime,ext=mod.parse_data_url(value)
        self.assertEqual(decoded,raw)
        self.assertEqual(mime,"image/png")
        self.assertTrue(ext)

    def test_workflow_uses_configured_checkpoint(self):
        old=mod.CHECKPOINT
        mod.CHECKPOINT="owner-model.safetensors"
        try:
            wf=mod.build_prompt("input.png","test product",0.3,"izakhono/test")
            self.assertEqual(wf["1"]["inputs"]["ckpt_name"],"owner-model.safetensors")
            self.assertEqual(wf["2"]["inputs"]["image"],"input.png")
            self.assertEqual(wf["6"]["inputs"]["denoise"],0.3)
            self.assertEqual(wf["8"]["class_type"],"SaveImage")
        finally:
            mod.CHECKPOINT=old

if __name__=="__main__":
    unittest.main()
