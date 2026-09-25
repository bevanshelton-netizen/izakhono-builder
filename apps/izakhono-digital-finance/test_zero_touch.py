#!/usr/bin/env python3
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from assessment_service import AssessmentService
from automation_engine import evaluate
from automation_store import AutomationStore
from credential_service import issue_completion_record, verify_completion_record
from learner_access import issue_token, verify_token

ROOT = Path(__file__).resolve().parent
automation = json.loads((ROOT / "automation.json").read_text(encoding="utf-8"))

with tempfile.TemporaryDirectory() as tmp:
    tmp_path = Path(tmp)
    store = AutomationStore(tmp_path / "zero-touch.sqlite3")

    license_data = store.set_institution_license(
        "bank-demo",
        active=True,
        seat_limit=100,
        product_id="fais-employee-empowerment",
        price_per_employee=1000,
    )
    assert license_data["active"] is True
    assert license_data["price_per_employee"] == 1000

    provisioned = store.provision_roster(
        "bank-demo",
        [
            {"learner_ref": "employee-001", "role": "representative_adviser"},
            {"learner_ref": "employee-002", "role": "compliance_risk"},
        ],
    )
    assert provisioned["provisioned"] == 2
    assert provisioned["contract_value_reference"] == 2000

    learner = store.get_learner("bank-demo", "employee-001")
    assert learner["payment_entitled"] is True
    assert learner["stage"] == "onboarding"

    access = issue_token(
        "test-learner-signing-key",
        learner_ref="employee-001",
        institution_ref="bank-demo",
        role="representative_adviser",
        ttl_seconds=3600,
    )
    claims = verify_token("test-learner-signing-key", access)
    assert claims["sub"] == "employee-001"
    assert claims["institution_ref"] == "bank-demo"

    question_bank = {
        "schema": "izakhono.digital.finance.question-bank.v1",
        "assessments": [
            {
                "id": "baseline",
                "title": "Synthetic CI baseline",
                "type": "baseline",
                "questions": [
                    {
                        "id": "q1",
                        "domain": "payments",
                        "prompt": "Synthetic test question one",
                        "options": ["A", "B", "C"],
                        "correct_option": "B",
                    },
                    {
                        "id": "q2",
                        "domain": "fraud",
                        "prompt": "Synthetic test question two",
                        "options": ["A", "B", "C"],
                        "correct_option": "A",
                    },
                ],
            },
            {
                "id": "final",
                "title": "Synthetic CI final",
                "type": "final",
                "questions": [
                    {
                        "id": "q3",
                        "domain": "conduct",
                        "prompt": "Synthetic test question three",
                        "options": ["A", "B", "C"],
                        "correct_option": "C",
                    },
                    {
                        "id": "q4",
                        "domain": "cyber",
                        "prompt": "Synthetic test question four",
                        "options": ["A", "B", "C"],
                        "correct_option": "B",
                    },
                ],
            },
        ],
    }
    bank_path = tmp_path / "question-bank.json"
    bank_path.write_text(json.dumps(question_bank), encoding="utf-8")

    assessments = AssessmentService(bank_path)
    public_baseline = assessments.present("baseline")
    assert "correct_option" not in json.dumps(public_baseline)
    scored = assessments.score("baseline", {"q1": "B", "q2": "A"})
    assert scored["percent"] == 100

    baseline_event = {
        "institution_ref": "bank-demo",
        "learner_ref": "employee-001",
        "role": "representative_adviser",
        "stage": "baseline",
        "baseline_score": scored["percent"],
    }
    baseline_decision = evaluate(
        {k: v for k, v in baseline_event.items() if k != "institution_ref"},
        automation,
    )
    assert baseline_decision["decision"] == "assign_learning_path"
    store.record_decision(baseline_event, baseline_decision)

    final_scored = assessments.score("final", {"q3": "C", "q4": "B"})
    final_event = {
        "institution_ref": "bank-demo",
        "learner_ref": "employee-001",
        "role": "representative_adviser",
        "stage": "final_assessment",
        "final_score": final_scored["percent"],
        "attempts": 1,
    }
    final_decision = evaluate(
        {k: v for k, v in final_event.items() if k != "institution_ref"},
        automation,
    )
    assert final_decision["decision"] == "completion_eligible"
    store.record_decision(final_event, final_decision)

    record = issue_completion_record(
        "test-credential-signing-key",
        learner_ref="employee-001",
        institution_ref="bank-demo",
        programme_id="fais-employee-empowerment",
    )
    verified = verify_completion_record("test-credential-signing-key", record)
    assert verified["degree"] is False
    assert verified["accreditation_claim"] is False
    assert verified["programme_id"] == "fais-employee-empowerment"

    store.store_credential(
        credential_ref=verified["credential_ref"],
        institution_ref="bank-demo",
        learner_ref="employee-001",
        programme_id="fais-employee-empowerment",
        record_token=record,
    )

    report = store.report("bank-demo")
    assert report["learners"] == 2
    assert report["completion_track"] >= 1

    actions = store.learner_actions("bank-demo", "employee-001")
    assert any(item["action"] == "learner_provisioned" for item in actions)

    try:
        store.provision_roster(
            "bank-demo",
            [{"learner_ref": "employee-003", "role": "representative_adviser", "email": "no@example.com"}],
        )
        raise AssertionError("PII-like extra roster fields must be rejected")
    except ValueError:
        pass

print("IZAKHONO Digital Finance zero-touch core tests passed.")
