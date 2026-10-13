#!/usr/bin/env python3
"""IZAKHONO free-first LLM router.

This is intentionally provider-neutral: it selects a provider and exposes the
configuration needed by an execution worker. It does not contain API secrets
and does not send network requests itself.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "free-llm-router.v1.json"


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def choose(capability: str, config: dict[str, Any]) -> list[dict[str, Any]]:
    providers = {p["id"]: p for p in config["providers"]}
    order = config["routing_defaults"].get(capability)
    if not order:
        raise ValueError(f"Unsupported capability: {capability}")

    candidates = []
    for provider_id in order:
        provider = providers.get(provider_id)
        if not provider:
            continue
        key_present = bool(os.getenv(provider["env_key"]))
        candidates.append({
            "id": provider["id"],
            "base_url": provider["base_url"],
            "env_key": provider["env_key"],
            "key_present": key_present,
            "free_tier": provider["free_tier"],
            "role": provider["role"],
        })
    return candidates


def main() -> int:
    parser = argparse.ArgumentParser(description="IZAKHONO free-first LLM provider router")
    parser.add_argument("capability", choices=["text", "reasoning", "code", "vision", "image", "audio", "video", "pdf"])
    parser.add_argument("--available-only", action="store_true", help="Only show providers whose API key is present")
    args = parser.parse_args()

    config = load_config()
    candidates = choose(args.capability, config)
    if args.available_only:
        candidates = [c for c in candidates if c["key_present"]]

    result = {
        "capability": args.capability,
        "policy": config["policy"],
        "selected": candidates[0] if candidates else None,
        "fallbacks": candidates[1:] if candidates else [],
        "warning": "Provider quotas, model availability and commercial terms change; verify before production execution.",
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
