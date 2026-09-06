#!/usr/bin/env python3
import hashlib
import hmac
import importlib.util
import json
import os
import tempfile
import time
from pathlib import Path

TMP = tempfile.TemporaryDirectory()
os.environ["IZAKHONO_ACCESS_DATA"] = TMP.name
os.environ["IZAKHONO_PAY_WEBHOOK_SECRET"] = "test-secret"
os.environ["IZAKHONO_ACCESS_INTERNAL_KEY"] = "internal-test-key"

spec = importlib.util.spec_from_file_location("izakhono_access", Path(__file__).with_name("app.py"))
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

payload = {
    "event": "payment.paid",
    "event_id": "evt_test_001",
    "intent": {
        "reference": "IZP-001",
        "metadata": {
            "access_entity_id": "faisready-entity",
            "access_subject": "customer@example.com",
            "access_product": "faisready",
            "access_plan": "monthly",
            "access_period_days": 30
        }
    }
}

with app.db_connect() as db:
    first = app.grant_from_payment(db, payload)
    second = app.grant_from_payment(db, payload)
    assert first["entity_id"] == "faisready-entity"
    assert first["subject"] == "customer@example.com"
    assert first["product_slug"] == "faisready"
    assert second["source_event_id"] == "evt_test_001"
    state = app.normalized_access(first)
    assert state["active"] is True
    assert state["usage_policy"]["usage_credit_gate"] is False
    assert state["usage_policy"]["message_quota"] is None

raw = json.dumps(payload, separators=(",", ":")).encode()
ts = str(int(time.time()))
sig = hmac.new(b"test-secret", f"{ts}.".encode() + raw, hashlib.sha256).hexdigest()
assert app.verify_pay_signature(raw, ts, sig) is True
assert app.verify_pay_signature(raw, ts, "bad") is False

print("IZAKHONO_ACCESS_TEST=PASS")
TMP.cleanup()
