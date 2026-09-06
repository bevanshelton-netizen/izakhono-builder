#!/usr/bin/env python3
import importlib.util
from pathlib import Path

here=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("fortress",here/"guard.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
p=m.load_policy()

def check(req, expected, reason=None):
    ok,why=m.authorize(req,p)
    assert ok is expected,(req,ok,why)
    if reason:
        assert why==reason,(why,reason)

check({
  "entity_id":"allegro-vibez",
  "provider_class":"external_ai",
  "purpose":"research",
  "data_class":"public",
  "payload":{"topic":"radio trends"}
},True)

check({
  "entity_id":"allegro-vibez",
  "provider_class":"external_ai",
  "purpose":"sanitized_debugging",
  "data_class":"internal_sanitized",
  "payload":{"error":"timeout","component":"stream"}
},True)

check({
  "entity_id":"allegro-vibez",
  "provider_class":"external_ai",
  "purpose":"core_runtime_inference_dependency",
  "data_class":"non_sensitive",
  "payload":{"text":"hello"}
},False,"forbidden_external_ai_purpose")

check({
  "entity_id":"izakhono-pay",
  "provider_class":"external_ai",
  "purpose":"research",
  "data_class":"credentials",
  "payload":{"topic":"payments"}
},False,"forbidden_data_class")

check({
  "entity_id":"izakhono-pay",
  "provider_class":"external_ai",
  "purpose":"advisory",
  "data_class":"internal_sanitized",
  "payload":{"api_key":"abc123"}
},False,"secret_like_field_detected")

check({
  "provider_class":"external_ai",
  "purpose":"research",
  "data_class":"public",
  "payload":{"topic":"x"}
},False,"entity_scope_required")

print("IZAKHONO_FORTRESS_POLICY=PASS")
