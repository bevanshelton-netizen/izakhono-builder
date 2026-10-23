#!/usr/bin/env python3
"""IZAKHONO PROVISIONER router/state-machine bridge v1.

The orchestrator owns workflow control only. Concrete adapters are injected at
runtime, keeping provider credentials, network calls, and infrastructure
implementation outside the provisioning control plane.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol

from adapter_router import AdapterRouter, RouteDecision, RouteRequest
from state_machine import PIPELINE, ProvisioningJob, Provisioner, State, StepResult


STATE_CAPABILITY: dict[State, str] = {
    State.TENANT_CREATED: "tenant",
    State.DOMAIN_READY: "domain",
    State.DNS_READY: "dns",
    State.SITE_READY: "site",
    State.TLS_READY: "tls",
    State.MAIL_READY: "mail",
    State.INTEGRATIONS_READY: "crm_whatsapp",
    State.ACCEPTANCE_PASSED: "acceptance",
}


class AdapterExecutor(Protocol):
    def execute(self, decision: RouteDecision, desired_state: Mapping[str, Any]) -> StepResult: ...


@dataclass(frozen=True)
class ExecutionRecord:
    operation_id: str
    state: str
    capability: str
    adapter: str
    ownership: str
    execution_key: str
    result_ok: bool


class ProvisionerOrchestrator:
    """Execute exactly one eligible provisioning stage per call."""

    def __init__(self, provisioner: Provisioner, router: AdapterRouter, executor: AdapterExecutor):
        self.provisioner = provisioner
        self.router = router
        self.executor = executor

    def run_once(self, job: ProvisioningJob, desired_state: Mapping[str, Any]) -> ExecutionRecord | None:
        if job.state in (State.BLOCKED, State.HANDOVER_READY):
            return None
        if job.state == State.PAYMENT_VERIFIED:
            # Payment verification is the entry gate, not an adapter action in this bridge.
            job.record("ENTRY_GATE_VERIFIED", state=job.state.value)

        next_state = job.next_state()
        if next_state is None:
            return None
        capability = STATE_CAPABILITY.get(next_state)
        if capability is None:
            raise RuntimeError(f"NO_CAPABILITY_FOR_STATE:{next_state.value}")

        operation_id = f"{job.job_id}:{next_state.value}"
        request = RouteRequest(
            operation_id=operation_id,
            tenant_id=job.tenant_id,
            capability=capability,
            desired_state=desired_state,
            idempotency_key=job.idempotency_key,
        )
        decision = self.router.select(request)
        job.record(
            "ADAPTER_SELECTED",
            state=next_state.value,
            capability=capability,
            adapter=decision.adapter.name,
            ownership=decision.adapter.ownership,
            execution_key=decision.execution_key,
        )
        result = self.executor.execute(decision, desired_state)
        self.provisioner.apply(job, result)
        job.record(
            "ADAPTER_EXECUTED",
            state=next_state.value,
            execution_key=decision.execution_key,
            ok=result.ok,
            evidence_ids=sorted(str(v) for v in result.evidence.get("evidence_ids", [])) if isinstance(result.evidence, Mapping) else [],
        )
        return ExecutionRecord(
            operation_id=operation_id,
            state=next_state.value,
            capability=capability,
            adapter=decision.adapter.name,
            ownership=decision.adapter.ownership,
            execution_key=decision.execution_key,
            result_ok=result.ok,
        )

    def run_to_handover(self, job: ProvisioningJob, desired_state: Mapping[str, Any]) -> ProvisioningJob:
        while job.state not in (State.BLOCKED, State.HANDOVER_READY):
            self.run_once(job, desired_state)
        if job.state == State.HANDOVER_READY:
            self.provisioner.handover(job)
        return job


def demo() -> None:
    class FakeExecutor:
        def execute(self, decision: RouteDecision, desired_state: Mapping[str, Any]) -> StepResult:
            return StepResult(True, {"verified": True, "evidence_ids": [decision.execution_key]})

    registry = {
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
    provisioner = Provisioner()
    router = AdapterRouter(registry)
    orchestrator = ProvisionerOrchestrator(provisioner, router, FakeExecutor())
    job = provisioner.create("tenant-demo", "order-orch-001")
    orchestrator.run_to_handover(job, {"template": "default"})
    assert job.state == State.HANDOVER_READY
    assert any(e["event"] == "ADAPTER_SELECTED" for e in job.audit)
    print("PROVISIONER_ORCHESTRATOR_SMOKE: PASS")


if __name__ == "__main__":
    demo()
