#!/usr/bin/env python3
"""IZAKHONO Node Independence Guardian v1.

Standard-library only. The guardian never assumes NODE01 is available.
It probes every enabled node, selects the healthiest highest-priority node,
and emits a routing decision. Public DNS/EDGE changes are deliberately left
to an authenticated provider adapter after the decision is accepted.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def probe(node: dict, timeout: float) -> dict:
    started = time.time()
    try:
        request = urllib.request.Request(
            node["health_url"], headers={"User-Agent": "IZAKHONO-Node-Guardian/1"}
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read(4096).decode("utf-8", "replace")
            ok = 200 <= response.status < 300
            return {
                "id": node["id"],
                "healthy": ok,
                "status": response.status,
                "latency_ms": round((time.time() - started) * 1000, 2),
                "body": body[:512],
            }
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        return {
            "id": node["id"],
            "healthy": False,
            "status": None,
            "latency_ms": round((time.time() - started) * 1000, 2),
            "error": str(exc)[:512],
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", default="infra/node-independence/node-registry.v1.json")
    parser.add_argument("--output", default="node-independence-decision.json")
    parser.add_argument("--timeout", type=float, default=3.0)
    args = parser.parse_args()

    registry = json.loads(Path(args.registry).read_text(encoding="utf-8"))
    nodes = [n for n in registry["nodes"] if n.get("enabled")]
    results = [probe(n, args.timeout) for n in nodes]
    by_id = {r["id"]: r for r in results}

    ranked = sorted(nodes, key=lambda n: (n.get("priority", 999999), n["id"]))
    selected = next((n for n in ranked if by_id[n["id"]]["healthy"]), None)

    decision = {
        "schema": "izakhono.node-independence/decision/v1",
        "policy": registry["policy"],
        "generated_at_epoch": int(time.time()),
        "selected_node": selected["id"] if selected else None,
        "selected_role": selected["role"] if selected else None,
        "healthy_nodes": [r["id"] for r in results if r["healthy"]],
        "failed_nodes": [r["id"] for r in results if not r["healthy"]],
        "primary_healthy": bool(by_id.get("NODE01", {}).get("healthy")),
        "external_fallback_required": selected is None,
        "results": results,
    }
    Path(args.output).write_text(json.dumps(decision, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(decision, indent=2))
    return 0 if selected else 2


if __name__ == "__main__":
    sys.exit(main())
