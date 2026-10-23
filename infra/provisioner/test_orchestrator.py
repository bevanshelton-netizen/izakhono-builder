#!/usr/bin/env python3
"""Dependency-free smoke/unit tests for the Provisioner router bridge."""
from __future__ import annotations

from typing import Any, Mapping

from adapter_router import AdapterRouter, RouteError, RouteDecision
from orchestrator import ProvisionerOrchestrator
from state_machine import Provisioner, State, StepResult


REGISTRY = {
    "adapters": {
        "tenant": {"owned": "izakhono-control"},
        "domain": {"owned": "izakhono-domain"},
        "dns": {"owned": "izakhono-dns"},
        "site": {"owned": "izakhono-host"},
        "tls": {"owned": "izakhono-edge"},
        "mail": {"owned": "izakhono-mail"},
        "crm_whatsapp": {"owned": "izakhono-integrations"},
        "acceptance": {"owned": "izakhono-acceptance"},
    }
}


class ScriptedExecutor:
    def __init__(self, results: list[StepResult]):
        self.results = list(results)
        self.calls: list[RouteDecision] = []

    def execute(self, decision: RouteDecision, desired_state: Mapping[str, Any]) -> StepResult:
        self.calls.append(decision)
        return self.results.pop(0)


def test_owned_route_and_deterministic_key() -> None:
    router = AdapterRouter(REGISTRY)
    request = __import__("adapter_router").RouteRequest("op", "tenant", "site", {})
    a = router.select(request)
    b = router.select(request)
    assert a.adapter.ownership == "owned"
    assert a.execution_key == b.execution_key


def test_unsupported_capability_blocks() -> None:
    router = AdapterRouter(REGISTRY)
    try:
        router.select(__import__("adapter_router").RouteRequest("op", "tenant", "unknown", {}))
    except RouteError as exc:
        assert str(exc) == "UNSUPPORTED_CAPABILITY"
    else:
        raise AssertionError("unsupported capability was not blocked")


def test_success_advances_state() -> None:
    p = Provisioner()
    job = p.create("tenant", "order-1")
    executor = ScriptedExecutor([StepResult(True, {"evidence_ids": ["ev-1"]})])
    orch = ProvisionerOrchestrator(p, AdapterRouter(REGISTRY), executor)
    record = orch.run_once(job, {})
    assert record is not None
    assert job.state == State.TENANT_CREATED
    assert job.evidence[State.PAYMENT_VERIFIED.value] == {"evidence_ids": ["ev-1"]}


def test_retry_then_success() -> None:
    p = Provisioner()
    job = p.create("tenant", "order-2")
    executor = ScriptedExecutor([
        StepResult(False, {"evidence_ids": []}, retryable=True, error_code="TEMPORARY"),
        StepResult(True, {"evidence_ids": ["ev-2"]}),
    ])
    orch = ProvisionerOrchestrator(p, AdapterRouter(REGISTRY), executor)
    orch.run_once(job, {})
    assert job.state == State.PAYMENT_VERIFIED
    orch.run_once(job, {})
    assert job.state == State.TENANT_CREATED


def test_permanent_failure_blocks() -> None:
    p = Provisioner()
    job = p.create("tenant", "order-3")
    executor = ScriptedExecutor([StepResult(False, {}, retryable=False, error_code="PERMANENT")])
    orch = ProvisionerOrchestrator(p, AdapterRouter(REGISTRY), executor)
    orch.run_once(job, {})
    assert job.state == State.BLOCKED


def test_missing_evidence_cannot_handover() -> None:
    p = Provisioner()
    job = p.create("tenant", "order-4")
    job.state = State.HANDOVER_READY
    try:
        p.handover(job)
    except RuntimeError as exc:
        assert "missing acceptance evidence" in str(exc)
    else:
        raise AssertionError("handover bypassed evidence gate")


def run() -> None:
    tests = [
        test_owned_route_and_deterministic_key,
        test_unsupported_capability_blocks,
        test_success_advances_state,
        test_retry_then_success,
        test_permanent_failure_blocks,
        test_missing_evidence_cannot_handover,
    ]
    for test in tests:
        test()
    print(f"PROVISIONER_ORCHESTRATOR_TESTS: PASS ({len(tests)})")


if __name__ == "__main__":
    run()
