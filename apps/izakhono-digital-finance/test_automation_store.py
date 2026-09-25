#!/usr/bin/env python3
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from automation_engine import evaluate
from automation_store import AutomationStore

ROOT = Path(__file__).resolve().parent
config = json.loads((ROOT / "automation.json").read_text(encoding="utf-8"))

with tempfile.TemporaryDirectory() as tmp:
    store = AutomationStore(Path(tmp) / "autopilot.sqlite3")

    payload = {
        "institution_ref": "institution-demo",
        "learner_ref": "learner-001",
        "stage": "baseline",
        "role": "representative_adviser",
        "baseline_score": 64,
    }
    decision_payload = {k: v for k, v in payload.items() if k != "institution_ref"}
    decision = evaluate(decision_payload, config)
    stored = store.record_decision(payload, decision)
    assert stored["stored"] is True
    assert stored["stage"] == "learning"

    report = store.report("institution-demo")
    assert report["learners"] == 1
    assert report["stages"]["learning"] == 1

    pending = store.pending_actions("institution-demo")
    assert isinstance(pending, list)

    payload2 = {
        "institution_ref": "institution-demo",
        "learner_ref": "learner-002",
        "stage": "learning",
        "role": "general_employee",
        "exception_codes": ["SECURITY_OR_FRAUD_SIGNAL"],
    }
    decision2 = evaluate({k: v for k, v in payload2.items() if k != "institution_ref"}, config)
    store.record_decision(payload2, decision2)

    report2 = store.report("institution-demo")
    assert report2["learners"] == 2
    assert report2["human_review"] == 1
    assert report2["pending_actions"] >= 2

    actions = store.pending_actions("institution-demo")
    assert any(item["action"] == "notify_governance_owner" for item in actions)
    assert store.ack_action("institution-demo", actions[0]["id"]) is True

    try:
        store.record_decision(
            {
                "institution_ref": "institution-demo",
                "learner_ref": "learner-003",
                "email": "person@example.com",
            },
            {"decision": "continue", "next_stage": "baseline", "next_actions": []},
        )
        raise AssertionError("PII payload should have been rejected")
    except ValueError as exc:
        assert "pii_fields_rejected" in str(exc)

print("IZAKHONO Digital Finance stateful autopilot tests passed.")
