#!/usr/bin/env python3
"""Stateless workforce automation decision engine for IZAKHONO Digital Finance Academy."""

from __future__ import annotations

from typing import Any

ALLOWED_FIELDS = {
    "learner_ref",
    "role",
    "stage",
    "baseline_score",
    "final_score",
    "attempts",
    "completed_modules",
    "total_modules",
    "exception_codes",
    "identity_verified",
    "payment_entitled",
}

PII_HINTS = {
    "name", "first_name", "last_name", "email", "phone", "mobile",
    "id_number", "identity_number", "passport", "address", "date_of_birth",
}


def _number(value: Any, default: float = 0) -> float:
    if isinstance(value, bool):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def validate_payload(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    unknown = sorted(set(payload) - ALLOWED_FIELDS)
    if unknown:
        errors.append("unapproved_fields:" + ",".join(unknown))

    pii = sorted(set(payload) & PII_HINTS)
    if pii:
        errors.append("pii_fields_rejected:" + ",".join(pii))

    learner_ref = payload.get("learner_ref")
    if not isinstance(learner_ref, str) or not learner_ref.strip():
        errors.append("learner_ref_required")
    elif len(learner_ref) > 96:
        errors.append("learner_ref_too_long")

    for key in ("baseline_score", "final_score"):
        if key in payload:
            score = _number(payload.get(key), -1)
            if score < 0 or score > 100:
                errors.append(f"{key}_must_be_0_to_100")

    return errors


def choose_path(score: float, thresholds: dict[str, Any]) -> str:
    if score <= thresholds["baseline_foundation_max"]:
        return "foundation"
    if score <= thresholds["baseline_standard_max"]:
        return "standard"
    return "accelerated"


def evaluate(payload: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    errors = validate_payload(payload)
    if errors:
        return {"ok": False, "errors": errors}

    gates = {item["code"]: item for item in config["governance_gates"]}
    exceptions = payload.get("exception_codes") or []
    matched = [gates[code] for code in exceptions if code in gates]
    if matched:
        return {
            "ok": True,
            "learner_ref": payload["learner_ref"],
            "decision": "human_review",
            "automated": False,
            "governance_gates": matched,
            "next_actions": ["pause_automation", "notify_governance_owner"],
        }

    stage = payload.get("stage") or "onboarding"
    role = payload.get("role") or "general_employee"
    role_modules = config["role_paths"].get(role, config["role_paths"]["general_employee"])
    thresholds = config["thresholds"]

    if stage == "onboarding":
        return {
            "ok": True,
            "learner_ref": payload["learner_ref"],
            "decision": "continue",
            "automated": True,
            "next_stage": "baseline",
            "next_actions": ["request_baseline_assessment"],
        }

    if stage in {"baseline", "path_assignment"}:
        score = _number(payload.get("baseline_score"), 0)
        learning_path = choose_path(score, thresholds)
        modules = list(role_modules)
        if learning_path == "foundation":
            for module in reversed(["df-101", "df-102"]):
                if module not in modules:
                    modules.insert(0, module)
        return {
            "ok": True,
            "learner_ref": payload["learner_ref"],
            "decision": "assign_learning_path",
            "automated": True,
            "path": learning_path,
            "role": role,
            "assigned_modules": modules,
            "next_stage": "learning",
        }

    if stage == "learning":
        completed = max(0, int(_number(payload.get("completed_modules"), 0)))
        total = max(1, int(_number(payload.get("total_modules"), len(role_modules))))
        percent = min(100, round((completed / total) * 100))
        if completed >= total:
            return {
                "ok": True,
                "learner_ref": payload["learner_ref"],
                "decision": "learning_complete",
                "automated": True,
                "progress_percent": 100,
                "next_stage": "final_assessment",
                "next_actions": ["request_final_assessment"],
            }
        return {
            "ok": True,
            "learner_ref": payload["learner_ref"],
            "decision": "continue_learning",
            "automated": True,
            "progress_percent": percent,
            "next_stage": "learning",
            "next_actions": ["unlock_next_required_module", "schedule_reminder_event"],
        }

    if stage in {"final_assessment", "remediation"}:
        score = _number(payload.get("final_score"), 0)
        attempts = max(0, int(_number(payload.get("attempts"), 0)))
        if score >= thresholds["completion_pass_percent"]:
            return {
                "ok": True,
                "learner_ref": payload["learner_ref"],
                "decision": "completion_eligible",
                "automated": True,
                "score": score,
                "next_stage": "certificate_eligibility",
            }
        if attempts < thresholds["remediation_max_attempts"]:
            return {
                "ok": True,
                "learner_ref": payload["learner_ref"],
                "decision": "remediation",
                "automated": True,
                "score": score,
                "next_stage": "remediation",
                "next_actions": ["assign_targeted_revision", "schedule_reassessment"],
            }
        return {
            "ok": True,
            "learner_ref": payload["learner_ref"],
            "decision": "human_review",
            "automated": False,
            "governance_gates": [{
                "code": "LEARNER_APPEAL",
                "owner": "authorised academic/programme reviewer",
                "reason": "Maximum automated remediation attempts reached."
            }],
            "next_actions": ["pause_automation", "notify_governance_owner"],
        }

    if stage == "certificate_eligibility":
        if not payload.get("identity_verified", False):
            return {
                "ok": True,
                "learner_ref": payload["learner_ref"],
                "decision": "await_verified_identity_adapter",
                "automated": True,
                "certificate_eligible": False,
                "next_actions": ["request_identity_verification"],
            }
        return {
            "ok": True,
            "learner_ref": payload["learner_ref"],
            "decision": "certificate_eligible",
            "automated": True,
            "certificate_eligible": True,
            "next_stage": "reporting",
            "next_actions": ["emit_certificate_issue_event", "emit_reporting_event"],
        }

    if stage == "reporting":
        return {
            "ok": True,
            "learner_ref": payload["learner_ref"],
            "decision": "complete",
            "automated": True,
            "next_stage": "complete",
            "next_actions": ["emit_management_report_event"],
        }

    return {
        "ok": True,
        "learner_ref": payload["learner_ref"],
        "decision": "unknown_stage",
        "automated": False,
        "next_actions": ["return_to_onboarding"],
    }
