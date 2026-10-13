#!/usr/bin/env python3
"""Plan a one-day IZAKHONO app build without exposing secrets or making deployment calls.

The planner converts a capability request into a deterministic sequence of stages,
selects free-first AI providers, and emits release gates and commercial outputs.
Actual network/deployment/payment actions remain separate adapters and require
explicit authorization where appropriate.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "one-day-app-factory.v1.json"


def load() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def build_plan(name: str, capabilities: list[str], cfg: dict) -> dict:
    unknown = [c for c in capabilities if c not in cfg["capabilities"]]
    if unknown:
        raise ValueError(f"Unsupported capabilities: {', '.join(unknown)}")
    routes = {c: cfg["capabilities"][c] for c in capabilities}
    return {
        "app": name,
        "policy": cfg["policy"],
        "stages": cfg["stages"],
        "ai_routes": routes,
        "release_gates": cfg["release_gates"],
        "commercial_outputs": cfg["commercial_outputs"],
        "execution_note": "Planning only: deployment, payments and external side effects require their dedicated authorized adapters.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="IZAKHONO One-Day App Factory planner")
    parser.add_argument("name")
    parser.add_argument("capabilities", nargs="+", choices=["text", "reasoning", "code", "vision", "audio", "video", "pdf"])
    args = parser.parse_args()
    print(json.dumps(build_plan(args.name, args.capabilities, load()), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
