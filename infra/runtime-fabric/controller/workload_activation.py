#!/usr/bin/env python3
"""Reusable workload activation bridge for the IZAKHONO runtime fabric.

The bridge keeps provisioning concerns separate from runtime activation. It
accepts a workload contract plus externally supplied node health and callbacks
for activation/acceptance. It never creates evidence, stores secrets, or marks
a workload LIVE_VERIFIED.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Mapping

from activation_transaction import TransactionResult, run_transaction

NODES = ("node01", "node02", "node03", "node04")


@dataclass(frozen=True)
class ActivationRequest:
    workload: str
    health: Mapping[str, bool]


def validate_contract(contract: Mapping) -> None:
    if contract.get("schema") != "izakhono.runtime-fabric.workload.v1":
        raise ValueError("unsupported workload contract schema")
    if not contract.get("workload"):
        raise ValueError("workload is required")

    runtime = contract.get("runtime", {})
    if runtime.get("mode") != "node-agnostic":
        raise ValueError("runtime mode must be node-agnostic")

    preferred = tuple(runtime.get("preferred_nodes", ()))
    if preferred != NODES:
        raise ValueError("preferred node order must be node01..node04")

    failover = tuple(runtime.get("failover_order", ()))
    expected = ("node02", "node03", "node04", "external-resilience")
    if failover != expected:
        raise ValueError("failover order must be node02,node03,node04,external-resilience")

    acceptance = contract.get("acceptance", {})
    promotion = acceptance.get("promotion", "")
    if promotion != "LIVE_VERIFIED only after all acceptance gates pass":
        raise ValueError("promotion rule is not fail-closed")


def activate_workload(
    contract: Mapping,
    request: ActivationRequest,
    activate: Callable[[str], bool],
    acceptance: Callable[[str], bool],
) -> TransactionResult:
    validate_contract(contract)
    if request.workload != contract["workload"]:
        raise ValueError("activation request workload does not match contract")
    return run_transaction(contract, request.health, activate, acceptance)
