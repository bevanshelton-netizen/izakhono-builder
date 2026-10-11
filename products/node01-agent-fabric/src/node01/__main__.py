from __future__ import annotations

import argparse
import json
import platform
from .engine import run_sync
from .registry import AGENTS


def main() -> int:
    parser = argparse.ArgumentParser(prog="node01", description="NODE01 autonomous agent workforce")
    parser.add_argument("--objective", help="objective for the workforce")
    parser.add_argument("--health", action="store_true", help="show local fabric health")
    args = parser.parse_args()

    if args.health:
        print(json.dumps({
            "service": "NODE01 Agent Fabric",
            "version": "0.1.0",
            "status": "ready",
            "agents_registered": len(AGENTS),
            "python": platform.python_version(),
            "execution": "deterministic-core / adapter-ready",
        }, indent=2))
        return 0

    if not args.objective:
        parser.error("--objective is required unless --health is used")
    receipt = run_sync(args.objective)
    print(json.dumps({
        "execution_id": receipt.execution_id,
        "status": receipt.status,
        "agents_registered": len(AGENTS),
        "receipt_hash": receipt.receipt_hash,
        "tasks": [
            {"id": task.task_id, "status": task.status.value, "agent": task.agent_id, "error": task.error}
            for task in receipt.tasks
        ],
    }, indent=2))
    return 0 if receipt.status == "completed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
