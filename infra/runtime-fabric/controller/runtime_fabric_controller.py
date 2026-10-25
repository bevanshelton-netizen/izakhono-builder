#!/usr/bin/env python3
"""IZAKHONO Runtime Fabric controller.

Node identities are software-defined. The controller selects a preferred runtime,
executes only through a supplied activation adapter, and never promotes a workload
without acceptance evidence. Secrets stay outside the repository.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

NODES = ("node01", "node02", "node03", "node04")
FAILOVER = ("node02", "node03", "node04", "external-resilience")


@dataclass(frozen=True)
class Decision:
    workload: str
    selected_node: str | None
    status: str
    reason: str


def load_workload(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("workload") != "kora-mail":
        raise ValueError("unsupported workload")
    runtime = data.get("runtime", {})
    if runtime.get("mode") != "node-agnostic":
        raise ValueError("workload must be node-agnostic")
    if tuple(runtime.get("preferred_nodes", [])) != NODES:
        raise ValueError("preferred node order must be node01-node04")
    if tuple(runtime.get("failover_order", [])) != FAILOVER:
        raise ValueError("invalid failover order")
    return data


def select_node(workload: dict, health: dict[str, bool]) -> str | None:
    for node in workload["runtime"]["preferred_nodes"]:
        if health.get(node) is True:
            return node
    return None


def decide(workload: dict, health: dict[str, bool]) -> Decision:
    selected = select_node(workload, health)
    if selected is None:
        return Decision(workload["workload"], None, "BLOCKED", "no healthy preferred node")
    return Decision(workload["workload"], selected, "READY", "healthy node selected")


def activate(
    workload_path: Path,
    health: dict[str, bool],
    adapter: Callable[[str], bool],
    execute: bool = False,
) -> Decision:
    workload = load_workload(workload_path)
    decision = decide(workload, health)
    if decision.selected_node is None:
        return decision
    if not execute:
        return Decision(decision.workload, decision.selected_node, "PLANNED", "dry-run; activation not executed")
    if not adapter(decision.selected_node):
        return Decision(decision.workload, decision.selected_node, "BLOCKED", "activation adapter failed")
    return Decision(decision.workload, decision.selected_node, "ACTIVATED", "activation adapter completed")


def main() -> int:
    root = Path(os.environ.get("IZAKHONO_RUNTIME_FABRIC_ROOT", Path(__file__).resolve().parents[2]))
    workload_path = root / "workloads" / "kora-mail.json"
    # Health evidence is intentionally supplied by the runtime fabric, not guessed.
    health_path = Path(os.environ.get("IZAKHONO_NODE_HEALTH", "/opt/izakhono/runtime-fabric/node-health.json"))
    health = json.loads(health_path.read_text(encoding="utf-8")) if health_path.exists() else {}
    execute = os.environ.get("IZAKHONO_EXECUTE", "0") == "1"
    decision = activate(workload_path, health, lambda _node: False, execute=execute)
    print(json.dumps(decision.__dict__, sort_keys=True))
    return 0 if decision.status in {"PLANNED", "ACTIVATED"} else 2


if __name__ == "__main__":
    raise SystemExit(main())
