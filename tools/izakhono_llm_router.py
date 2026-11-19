#!/usr/bin/env python3
"""IZAKHONO local-only Ollama-compatible inference route.

This module never selects a hosted inference provider or reads API keys.
If the local runtime is unavailable, callers must use deterministic native
fallbacks rather than rotating to an external service.
"""
from __future__ import annotations

import argparse
import ipaddress
import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "free-llm-router.v1.json"
LOCAL_CAPABILITIES = {"text", "reasoning", "code"}


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def _local_url() -> str:
    value = os.getenv("IZAKHONO_LOCAL_MODEL_URL", "http://127.0.0.1:11434/api/chat")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError("Invalid local Ollama-compatible endpoint")
    host = parsed.hostname.lower()
    local_name = host in {"localhost"} or host.endswith((".localhost", ".local", ".internal"))
    try:
        address = ipaddress.ip_address(host)
        private_address = address.is_private or address.is_loopback or address.is_link_local
    except ValueError:
        private_address = False
    if not (local_name or private_address):
        raise ValueError("Local model endpoint must resolve to a private or loopback address")
    return value


def choose(capability: str, config: dict[str, Any]) -> list[dict[str, Any]]:
    if capability not in LOCAL_CAPABILITIES:
        return []
    provider = next((item for item in config.get("providers", []) if item.get("id") == "ollama-compatible-local"), None)
    if provider is None:
        raise ValueError("Local inference adapter is missing from configuration")
    return [{
        "id": provider["id"],
        "base_url": _local_url(),
        "env_key": None,
        "key_present": True,
        "free_tier": True,
        "role": "local-inference",
        "model": os.getenv("IZAKHONO_LOCAL_MODEL", "qwen2.5-coder:3b"),
        "capabilities": sorted(LOCAL_CAPABILITIES),
        "requires_runtime_probe": True,
        "fallback": "deterministic-native",
    }]


def main() -> int:
    parser = argparse.ArgumentParser(description="IZAKHONO local-only inference router")
    parser.add_argument("capability", choices=["text", "reasoning", "code", "vision", "image", "audio", "video", "pdf"])
    parser.add_argument("--available-only", action="store_true", help="Retained for CLI compatibility; local runtime reachability is verified by the worker.")
    args = parser.parse_args()

    config = load_config()
    candidates = choose(args.capability, config)
    result = {
        "capability": args.capability,
        "policy": config["policy"],
        "selected": candidates[0] if candidates else None,
        "fallbacks": [],
        "deterministic_fallback": "native-template-or-rule-engine",
        "external_inference_allowed": False,
        "warning": None if candidates else "Capability has no local inference adapter; deterministic native fallback is required.",
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
