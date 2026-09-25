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
assert "navigator.clipboard" in js

print(
    "IZAKHONO Digital Finance verification passed: "
    f"{len(module_ids)} modules, {lesson_count} lessons, privacy boundary intact."
)
