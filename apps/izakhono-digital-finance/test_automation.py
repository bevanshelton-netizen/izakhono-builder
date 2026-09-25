#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from automation_engine import evaluate

ROOT = Path(__file__).resolve().parent
config = json.loads((ROOT / "automation.json").read_text(encoding="utf-8"))

r = evaluate({"learner_ref":"demo-001","stage":"onboarding"}, config)
assert r["decision"] == "continue" and r["next_stage"] == "baseline"

r = evaluate({"learner_ref":"demo-002","stage":"baseline","role":"compliance_risk","baseline_score":55}, config)
assert r["decision"] == "assign_learning_path" and r["path"] == "foundation"
assert "lab-compliance" in r["assigned_modules"]

r = evaluate({"learner_ref":"demo-003","stage":"final_assessment","final_score":79,"attempts":0}, config)
assert r["decision"] == "remediation"

r = evaluate({"learner_ref":"demo-004","stage":"final_assessment","final_score":86,"attempts":1}, config)
assert r["decision"] == "completion_eligible"

r = evaluate({"learner_ref":"demo-005","stage":"certificate_eligibility","identity_verified":False}, config)
assert r["decision"] == "await_verified_identity_adapter"

r = evaluate({"learner_ref":"demo-006","stage":"learning","exception_codes":["SECURITY_OR_FRAUD_SIGNAL"]}, config)
assert r["decision"] == "human_review" and r["automated"] is False

r = evaluate({"learner_ref":"demo-007","stage":"baseline","email":"person@example.com"}, config)
assert r["ok"] is False and any("unapproved_fields" in x for x in r["errors"])

print("IZAKHONO Digital Finance automation tests passed.")
