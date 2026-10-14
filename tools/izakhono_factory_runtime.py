#!/usr/bin/env python3
"""IZAKHONO One-Day App Factory runtime contract.

The runtime is intentionally provider-neutral. It turns a build brief into a
strict, auditable stage plan and selects an LLM route for AI stages. Actual
side effects (GitHub/Vercel/Cloudflare/payment) remain behind explicit worker
adapters and must return evidence before a stage can be marked complete.
"""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

from izakhono_llm_router import choose, load_config

STAGES = (
    "intake",
    "plan",
    "route_ai",
    "build",
    "security",
    "qa",
    "package",
    "deploy",
    "revenue",
)

SIDE_EFFECT_STAGES = {"deploy", "revenue"}


@dataclass(frozen=True)
class Stage:
    id: str
    status: str
    requires_evidence: bool
    side_effect: bool


def brief_id(brief: str) -> str:
    digest = hashlib.sha256(brief.strip().encode("utf-8")).hexdigest()
    return f"build-{digest[:16]}"


def infer_capability(brief: str) -> str:
    text = brief.lower()
    if any(word in text for word in ("voice", "audio", "speech")):
        return "audio"
    if any(word in text for word in ("image", "photo", "design", "visual")):
        return "vision"
    if any(word in text for word in ("video", "reel", "film")):
        return "video"
    if any(word in text for word in ("pdf", "document")):
        return "pdf"
    if any(word in text for word in ("code", "software", "app", "website", "api")):
        return "code"
    return "reasoning"


def build_plan(brief: str, *, available_only: bool = True) -> dict[str, Any]:
    if not brief.strip():
        raise ValueError("Build brief cannot be empty")

    capability = infer_capability(brief)
    config = load_config()
    candidates = choose(capability, config)
    if available_only:
        candidates = [item for item in candidates if item["key_present"]]

    stages = [
        asdict(Stage(s, "ready", s in {"build", "security", "qa", "package", "deploy", "revenue"}, s in SIDE_EFFECT_STAGES))
        for s in STAGES
    ]

    return {
        "schema": "izakhono.factory-run/v1",
        "run_id": brief_id(brief),
        "brief": brief.strip(),
        "capability": capability,
        "llm": {
            "policy": config["policy"],
            "selected": candidates[0] if candidates else None,
            "fallbacks": candidates[1:],
        },
        "stages": stages,
        "gates": {
            "owner_authorized": False,
            "security_passed": False,
            "qa_passed": False,
            "artifact_verified": False,
            "deployment_evidence": False,
            "revenue_path_verified": False,
        },
        "public_live": False,
        "warning": "No side-effect stage may be promoted without explicit worker evidence.",
    }


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Create an IZAKHONO factory execution plan")
    parser.add_argument("brief")
    parser.add_argument("--include-unconfigured-providers", action="store_true")
    args = parser.parse_args()

    plan = build_plan(args.brief, available_only=not args.include_unconfigured_providers)
    print(json.dumps(plan, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
