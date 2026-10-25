#!/usr/bin/env python3
"""Deterministic tests for the Provisioner → Runtime Fabric handoff."""
from __future__ import annotations

import json
from pathlib import Path

from runtime_fabric_bridge import handoff

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "runtime-fabric" / "workloads" / "kora-mail.json"
CONTRACT = json.loads(CONTRACT_PATH.read_text())


def test_no_healthy_node_blocks() -> None:
    result = handoff(
        CONTRACT,
        {node: False for node in ("node01", "node02", "node03", "node04")},
        lambda _node: True,
        lambda _node: True,
    )
    assert result.status == "BLOCKED"
    assert result.reason == "NO_HEALTHY_NODE"


def test_node01_failure_fails_over_to_node02() -> None:
    result = handoff(
        CONTRACT,
        {"node01": False, "node02": True, "node03": True, "node04": True},
        lambda node: node == "node02",
        lambda node: node == "node02",
    )
    assert result.status == "READY_FOR_PROMOTION"
    assert result.node == "node02"


def test_activation_failure_blocks() -> None:
    result = handoff(
        CONTRACT,
        {"node01": True, "node02": True, "node03": True, "node04": True},
        lambda _node: False,
        lambda _node: True,
    )
    assert result.status == "BLOCKED"
    assert result.reason == "ACTIVATION_FAILED"


def test_acceptance_failure_blocks() -> None:
    result = handoff(
        CONTRACT,
        {"node01": True, "node02": True, "node03": True, "node04": True},
        lambda _node: True,
        lambda _node: False,
    )
    assert result.status == "BLOCKED"
    assert result.reason == "ACCEPTANCE_FAILED"


def test_successful_handoff_is_not_live_promotion() -> None:
    result = handoff(
        CONTRACT,
        {"node01": True, "node02": True, "node03": True, "node04": True},
        lambda node: node == "node01",
        lambda node: node == "node01",
    )
    assert result.status == "READY_FOR_PROMOTION"
    assert result.node == "node01"
    assert not hasattr(result, "live_verified")


if __name__ == "__main__":
    tests = [
        test_no_healthy_node_blocks,
        test_node01_failure_fails_over_to_node02,
        test_activation_failure_blocks,
        test_acceptance_failure_blocks,
        test_successful_handoff_is_not_live_promotion,
    ]
    for test in tests:
        test()
    print(f"Provisioner → Runtime Fabric bridge tests: PASS ({len(tests)})")
