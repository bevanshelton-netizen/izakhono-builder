#!/usr/bin/env python3
"""IZAKHONO Runtime Fabric controller.

Node identities are software-defined. The controller selects a preferred runtime,
executes only through the supplied KORA activation adapter, and never promotes a
workload without acceptance evidence. Secrets stay outside the repository.
"""
from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

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


def activate(workload_path: Path, health: dict[str, bool], execute: bool = False) -> Decision:
    workload = load_workload(workload_path)
    decision = decide(workload, health)
    if decision.selected_node is None:
        return decision
    if not execute:
        return Decision(decision.workload, decision.selected_node, "PLANNED", "dry-run; activation not executed")

    root = workload_path.parents[1]
    adapter = root / "activation" / "KORA-MAIL-ACTIVATE.sh"
    if not adapter.is_file() or not os.access(adapter, os.X_OK):
        return Decision(decision.workload, decision.selected_node, "BLOCKED", "KORA activation adapter unavailable")

    env = os.environ.copy()
    env["IZAKHONO_NODE_ID"] = decision.selected_node
    try:
        completed = subprocess.run(
            [str(adapter)],
            cwd=str(root.parent),
            env=env,
            check=False,
        )
    except OSError as exc:
        return Decision(decision.workload, decision.selected_node, "BLOCKED", f"activation adapter execution failed: {exc}")

    if completed.returncode != 0:
        return Decision(decision.workload, decision.selected_node, "BLOCKED", "KORA activation adapter failed")
    return Decision(decision.workload, decision.selected_node, "ACTIVATED", "KORA activation adapter completed")


def main() -> int:
    root = Path(os.environ.get("IZAKHONO_RUNTIME_FABRIC_ROOT", Path(__file__).resolve().parents[1]))
    workload_path = root / "workloads" / "kora-mail.json"
    health_path = Path(os.environ.get("IZAKHONO_NODE_HEALTH", "/opt/izakhono/runtime-fabric/node-health.json"))
    health = json.loads(health_path.read_text(encoding="utf-8")) if health_path.exists() else {}
    execute = os.environ.get("IZAKHONO_EXECUTE", "0") == "1"
    decision = activate(workload_path, health, execute=execute)
    print(json.dumps(decision.__dict__, sort_keys=True))
    return 0 if decision.status in {"PLANNED", "ACTIVATED"} else 2


if __name__ == "__main__":
    raise SystemExit(main())
