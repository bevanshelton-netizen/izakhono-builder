#!/usr/bin/env python3
"""Plan an IZAKHONO app build without external AI inference or deployment calls."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "free-llm-router.v1.json"


def load() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def build_plan(name: str, capabilities: list[str], cfg: dict) -> dict:
    routing = cfg.get("routing_defaults", {})
    unknown = [capability for capability in capabilities if capability not in routing]
    if unknown:
        raise ValueError(f"Unsupported capabilities: {', '.join(unknown)}")
    routes = {
        capability: {
            "provider": "ollama-compatible-local" if routing[capability] else "deterministic-native",
            "fallback": "deterministic-native",
            "external_inference_allowed": False,
        }
        for capability in capabilities
    }
    return {
        "app": name,
        "policy": cfg["policy"],
        "stages": ["intake", "plan", "build", "security", "qa", "package", "release-evidence"],
        "ai_routes": routes,
        "release_gates": ["build", "security", "tests", "snapshot", "acceptance"],
        "commercial_outputs": [],
        "execution_note": "Planning only: inference is local-only; deterministic native fallbacks are used when a local capability is unavailable. Deployment, payments and external side effects require dedicated authorized adapters.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an IZAKHONO factory execution plan")
    parser.add_argument("name")
    parser.add_argument("capabilities", nargs="+", choices=["text", "reasoning", "code", "vision", "audio", "video", "pdf"])
    args = parser.parse_args()
    print(json.dumps(build_plan(args.name, args.capabilities, load()), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
