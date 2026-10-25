#!/usr/bin/env python3
"""Deterministic runtime activation transaction for IZAKHONO workloads.

This layer coordinates node selection, activation, health evidence and promotion.
It never creates acceptance evidence; external evidence must be supplied by the
runtime acceptance system.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Mapping

from runtime_fabric_controller import Decision, decide


@dataclass(frozen=True)
class TransactionResult:
    workload: str
    node: str | None
    status: str
    stage: str
    reason: str


def run_transaction(
    workload: Mapping,
    health: Mapping[str, bool],
    activate: Callable[[str], bool],
    acceptance: Callable[[str], bool],
) -> TransactionResult:
    """Run one fail-closed activation transaction.

    The transaction is intentionally side-effect-light: the supplied callbacks
    own runtime activation and evidence verification. No callback means success.
    """
    decision: Decision = decide(dict(workload), dict(health))
    if decision.selected_node is None:
        return TransactionResult(decision.workload, None, "BLOCKED", "selection", decision.reason)

    node = decision.selected_node
    if not activate(node):
        return TransactionResult(decision.workload, node, "BLOCKED", "activation", "activation failed")

    if not acceptance(node):
        return TransactionResult(decision.workload, node, "BLOCKED", "acceptance", "acceptance evidence failed")

    return TransactionResult(decision.workload, node, "READY_FOR_PROMOTION", "acceptance", "all pre-promotion gates passed")
