#!/usr/bin/env python3
"""IZAKHONO Replica Engine v1.

A clean-room product-building orchestrator inspired by the public replica-skill
workflow. It creates a deterministic handoff package for IZAKHONO BUILDER.

No network access. No copying of target source, trademarks, proprietary assets,
private APIs, or protected content. Public/owner-authorized observations only.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, re
from pathlib import Path
from datetime import datetime, timezone

STAGES = [
    ("recon", "Reverse-engineer allowed product behaviour into screens, flows and features."),
    ("architect", "Choose the application architecture, data model, APIs and build order."),
    ("design", "Create original design tokens, components, states and accessibility rules."),
    ("build", "Hand the normalized build intent to IZAKHONO BUILDER for source generation."),
    ("backend", "Define authentication, data, payments, integrations and server-side boundaries."),
    ("test", "Generate happy-path, edge-case, accessibility and security test requirements."),
    ("diff", "Compare approved requirements against the generated product without copying protected assets."),
    ("entrepreneur", "Turn verified customer evidence into product improvements and positioning."),
    ("brand", "Create an independent name, identity, messaging and original assets brief."),
    ("launch", "Prepare pricing, landing-page, release and channel requirements."),
    ("deploy", "Prepare an evidence-gated deployment and handover plan; never claim public-live without proof."),
]
TARGETS = {"app", "website", "game", "software"}
MODULE_WORDS = {
    "payments": r"pay|payment|checkout|sell|shop|store|order|invoice|subscription",
    "auth": r"login|sign.?up|account|user|member",
    "chat": r"chat|message|community|social|comment",
    "uploads": r"upload|photo|image|file|media|gallery",
    "video": r"video|stream|movie|film|creator",
    "learning": r"course|learn|student|school|academy|lesson|exam",
    "recurring": r"schedule|recurring|automation|workflow|reminder",
    "email": r"email|newsletter|mail",
    "seo": r"seo|search|google|discover",
    "marketplace": r"marketplace|vendor|provider|buyer|seller|booking",
    "game": r"game|gaming|level|racing|arcade|quiz game",
    "docflow": r"document|proposal|contract|agreement|pdf|signature",
    "speech": r"audio|voice|speech|narrat",
    "transcription": r"transcrib|caption|subtitle",
}

def slug(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return value[:52] or "izakhono-product"

def infer_target(brief: str, explicit: str = "") -> str:
    if explicit in TARGETS:
        return explicit
    p = brief.lower()
    if re.search(r"\b(game|gaming|racing|arcade|quiz game)\b", p): return "game"
    if re.search(r"\b(website|web site|landing page|storefront)\b", p): return "website"
    if re.search(r"\b(desktop|software|erp|crm|saas|system|tool)\b", p): return "software"
    return "app"

def infer_modules(brief: str, target: str) -> list[str]:
    p = brief.lower()
    modules = {"ai", "integrations", "publish", "growth", "admin", "analytics"}
    if target == "website": modules.add("seo")
    if target == "game": modules.update({"game", "uploads"})
    for module, pattern in MODULE_WORDS.items():
        if re.search(r"\b(?:" + pattern + r")\b", p): modules.add(module)
    return sorted(modules)

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--brief", required=True)
    ap.add_argument("--target", default="")
    ap.add_argument("--name", default="")
    ap.add_argument("--out", default="replica")
    args = ap.parse_args()

    brief = re.sub(r"\s+", " ", args.brief).strip()[:1200]
    if len(brief) < 8:
        raise SystemExit("Brief must contain at least 8 characters.")
    target = infer_target(brief, args.target)
    name = (args.name.strip()[:100] or " ".join(brief.split()[:6]).title())
    modules = infer_modules(brief, target)
    now = datetime.now(timezone.utc).isoformat()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "design").mkdir(exist_ok=True)
    (out / "tests").mkdir(exist_ok=True)

    intent = {
        "schema": "izakhono.replica-engine/intent-v1",
        "created_at": now,
        "clean_room": True,
        "target": target,
        "name": name,
        "slug": slug(name),
        "brief": brief,
        "modules": modules,
        "source_rules": [
            "Use public or owner-authorized observations only.",
            "Rebuild functionality and interaction patterns, not protected expression.",
            "Do not copy source code, logos, trademarks, proprietary assets, private APIs or protected content.",
            "Rebrand before launch.",
            "Do not claim public-live without deployment evidence.",
        ],
    }
    (out / "intent.json").write_text(json.dumps(intent, indent=2) + "\n", encoding="utf-8")

    workflow = {
        "schema": "izakhono.replica-engine/workflow-v1",
        "engine": "IZAKHONO REPLICA ENGINE",
        "status": "planned",
        "stages": [{"id": s, "purpose": p, "status": "ready" if s == "recon" else "queued"} for s,p in STAGES],
        "handoff": {"builder": "/api/build-anything", "public_live": False, "release_gate": "owned-runtime-deployment-verification"},
    }
    (out / "workflow.json").write_text(json.dumps(workflow, indent=2) + "\n", encoding="utf-8")

    with (out / "features.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "priority", "feature", "evidence", "stage", "status"])
        w.writerow(["F01", "must", "Core product flow described by owner brief", "owner-brief", "recon", "planned"])
        for i, module in enumerate(modules, 2):
            w.writerow([f"F{i:02d}", "should", module, "deterministic-inference", "architect", "planned"])

    architecture = f"""# Architecture — {name}\n\nTarget: **{target}**\n\n## Build contract\n- IZAKHONO BUILDER remains the source-generation engine.\n- Internal IZAKHONO repository remains the source of truth.\n- Owned-first, externally reversible infrastructure.\n- Public deployment remains evidence-gated.\n\n## Modules\n{''.join('- ' + m + chr(10) for m in modules)}\n\n## Required gates\n1. Requirements and clean-room review\n2. Generated source validation\n3. Internal repository commit\n4. Release candidate receipt\n5. Owned-runtime HTTPS and end-to-end acceptance\n6. Only then may public-live status be asserted\n"""
    (out / "architecture.md").write_text(architecture, encoding="utf-8")

    tokens = {
        "schema": "izakhono.design/tokens-v1",
        "brand": "IZAKHONO product — independent identity required",
        "accessibility": {"min_text_contrast": "WCAG AA", "keyboard": True, "focus_visible": True},
        "spacing": [4,8,12,16,24,32,48,64],
        "radius": {"sm": 8, "md": 12, "lg": 18},
        "type": {"body": "system-ui", "heading": "system-ui"},
        "note": "Specific colours and imagery are selected per product after brand stage; do not inherit a target product's protected identity.",
    }
    (out / "design" / "tokens.json").write_text(json.dumps(tokens, indent=2) + "\n", encoding="utf-8")

    test_plan = """# Test Plan\n\nEvery core flow must cover: happy path, empty input, long input, emoji/accents, double submit, refresh, back navigation, slow network, offline, expired session, cross-user data isolation, mobile width, keyboard navigation and accessible labels.\n\nNegative cases must cover invalid credentials, denied permissions, failed payment where applicable, deleted records and server errors.\n\nRelease rule: no open S1 security/data-loss/payment/core-flow defect.\n"""
    (out / "tests" / "test-plan.md").write_text(test_plan, encoding="utf-8")

    manifest = {
        "schema": "izakhono.replica-engine/package-v1",
        "engine_version": 1,
        "intent_sha256": hashlib.sha256((out / "intent.json").read_bytes()).hexdigest(),
        "workflow_sha256": hashlib.sha256((out / "workflow.json").read_bytes()).hexdigest(),
        "generated_at": now,
        "builder_endpoint": "/api/build-anything",
        "release_candidate_only": True,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"[PASS] IZAKHONO Replica Engine package created at {out}/")
    print(f"       target={target} name={name!r} modules={','.join(modules)}")
    print("       next=send normalized intent to IZAKHONO BUILDER /api/build-anything")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
