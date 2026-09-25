#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

required = [
    "index.html",
    "styles.css",
    "app.js",
    "curriculum.json",
    "platform.json",
    "institutions.json",
    "locales.json",
    "institutional-offers.json",
    "automation.json",
    "assessment-blueprint.json",
    "adapter-contracts.json",
    "automation_engine.py",
    "automation_store.py",
    "learner_access.py",
    "assessment_service.py",
    "credential_service.py",
    "test_zero_touch.py",
    "test_automation.py",
    "test_automation_store.py",
    "engine.py",
    "healthz",
]

for name in required:
    path = ROOT / name
    assert path.exists(), f"missing required file: {name}"
    assert path.stat().st_size > 0, f"empty required file: {name}"

curriculum = json.loads((ROOT / "curriculum.json").read_text(encoding="utf-8"))
platform = json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))
institutions = json.loads((ROOT / "institutions.json").read_text(encoding="utf-8"))
locales = json.loads((ROOT / "locales.json").read_text(encoding="utf-8"))
offers = json.loads((ROOT / "institutional-offers.json").read_text(encoding="utf-8"))
automation = json.loads((ROOT / "automation.json").read_text(encoding="utf-8"))
assessment_blueprint = json.loads((ROOT / "assessment-blueprint.json").read_text(encoding="utf-8"))
adapter_contracts = json.loads((ROOT / "adapter-contracts.json").read_text(encoding="utf-8"))

assert curriculum["schema"] == "izakhono.digital.finance.curriculum.v1"
assert curriculum["operator"] == "IZAKHONO AFRICA (PTY) LTD"
assert len(curriculum["tracks"]) == 3
assert any(track["commercial_tier"] == "Free" for track in curriculum["tracks"])
assert any(track["commercial_tier"] == "Paid" for track in curriculum["tracks"])

module_ids = []
lesson_count = 0
for track in curriculum["tracks"]:
    assert track["modules"], f"track has no modules: {track['id']}"
    for module in track["modules"]:
        assert module["lessons"], f"module has no lessons: {module['id']}"
        module_ids.append(module["id"])
        lesson_count += len(module["lessons"])

assert len(module_ids) == len(set(module_ids)), "duplicate module id"
assert lesson_count >= 30, "launch curriculum is unexpectedly thin"

assert platform["platform_id"] == "izakhono-digital-finance"
assert platform["engine"]["type"].startswith("Independent")
assert platform["data"]["tracking"] == "None"
assert platform["legal"]["degree_claim"] is False
assert platform["legal"]["accreditation_claim"] is False
assert platform["payments"]["state"] == "GATED_PENDING_VERIFIED_PRODUCT_CHECKOUT"
assert institutions["schema"] == "izakhono.digital.finance.institutions.v1"
assert len(institutions["audiences"]) >= 8
assert institutions["commercial"]["model"]
assert locales["schema"] == "izakhono.digital.finance.locales.v1"
assert len(locales["locales"]) >= 10
assert locales["locales"]["ar"]["dir"] == "rtl"
assert all(item["status"] == "interface-ready" for item in locales["locales"].values())
assert offers["schema"] == "izakhono.digital.finance.institutional.offers.v1"
assert len(offers["offers"]) >= 5
fais_offer = next(item for item in offers["offers"] if item["id"] == "fais-employee-empowerment")
assert fais_offer["pricing"]["price"] == 1000
assert fais_offer["pricing"]["currency"] == "ZAR"
assert automation["schema"] == "izakhono.digital.finance.automation.v1"
assert automation["mode"] == "automated_normal_path_human_governance_exceptions"
assert automation["privacy"]["engine_state"] == "stateless"
assert automation["no_human_claim"] is False
assert len(automation["governance_gates"]) >= 6
assert automation["thresholds"]["completion_pass_percent"] == 80
assert assessment_blueprint["schema"] == "izakhono.digital.finance.assessment.blueprint.v1"
assert all("answer keys" not in str(item).lower() for item in assessment_blueprint.get("assessment_types", []))
assert adapter_contracts["schema"] == "izakhono.digital.finance.adapter.contracts.v1"
assert len(adapter_contracts["adapters"]) >= 6
assert all(item.get("state") for item in adapter_contracts["adapters"])
adapter_states = {item["id"]: item["state"] for item in adapter_contracts["adapters"]}
assert adapter_states["institutional_roster"] == "built"
assert adapter_states["management_reporting"] == "built"
assert adapter_states["payment_entitlement"].startswith("institutional_license_entitlement_built")
assert adapter_states["identity_auth"].startswith("pseudonymous_token_core_ready")
assert adapter_states["certificate_issuer"].startswith("signed_pseudonymous_completion_record_built")

html = (ROOT / "index.html").read_text(encoding="utf-8")
js = (ROOT / "app.js").read_text(encoding="utf-8")
css = (ROOT / "styles.css").read_text(encoding="utf-8")

for forbidden in (
    "googletagmanager",
    "google-analytics",
    "facebook.net",
    "connect.facebook",
    "segment.com",
    "hotjar",
):
    assert forbidden not in html.lower()
    assert forbidden not in js.lower()
    assert forbidden not in css.lower()

assert "university degree" in html.lower()
assert "ikHokha".lower() in html.lower()
assert "/api/v1/status" in js
assert "/api/v1/institutions" in js
assert "/api/v1/locales" in js
assert 'id="languageSelect"' in html
assert 'id="institutionGrid"' in html
assert 'id="proposalInstitution"' in html
assert "/api/v1/offers" in js
assert "/api/v1/automation/evaluate" in js
engine_source = (ROOT / "engine.py").read_text(encoding="utf-8")
assert "/api/v1/admin/automation/event" in engine_source
assert "/api/v1/admin/automation/report" in engine_source
assert "/api/v1/admin/automation/outbox" in engine_source
assert "PRIMARY KEY (institution_ref, learner_ref)" in (ROOT / "automation_store.py").read_text(encoding="utf-8")
assert "IZAKHONO_DF_ADMIN_TOKEN" in engine_source
assert "IZAKHONO_DF_LEARNER_SIGNING_KEY" in engine_source
assert "IZAKHONO_DF_CREDENTIAL_SIGNING_KEY" in engine_source
assert "IZAKHONO_DF_QUESTION_BANK" in engine_source
assert "/api/v1/admin/institution/license" in engine_source
assert "/api/v1/admin/roster/provision" in engine_source
assert "/api/v1/admin/learner/access-token" in engine_source
assert "/api/v1/learner/assessment/submit" in engine_source
assert "/api/v1/learner/completion-record" in engine_source
assert "/api/v1/completion/verify" in engine_source
assert 'id="runAutomationDemo"' in html
assert "Human governance gates" in html
assert "90–95%" in html
assert "navigator.clipboard" in js

print(
    "IZAKHONO Digital Finance verification passed: "
    f"{len(module_ids)} modules, {lesson_count} lessons, privacy boundary intact."
)
