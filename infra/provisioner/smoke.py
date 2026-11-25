#!/usr/bin/env python3
"""Deterministic end-to-end Provisioner contract smoke tests."""
from __future__ import annotations

from datetime import datetime, timezone

from acceptance_engine import AcceptanceEngine
from adapter_catalog import CAPABILITY_TO_ADAPTER
from job_queue import JobQueue
from job_store import MemoryJobStore
from service import CreateJobRequest, ProvisionerService, ServiceError
from state_machine import State


def smoke_catalog():
    capabilities = ("tenant", "domain", "dns", "site", "tls", "mail", "crm_whatsapp", "acceptance")

    def implementation(capability):
        def execute(payload):
            return {
                "evidence_id": f"test-{capability}-{payload['operation_id']}",
                "observed_at": datetime.now(timezone.utc).isoformat(),
                "verified": True,
                "checks": [f"test.{capability}"],
                "simulation": False,
            }
        return execute

    return {
        CAPABILITY_TO_ADAPTER[capability]: implementation(capability)
        for capability in capabilities
    }


def registry():
    return {
        "adapters": {key: {"owned": value} for key, value in CAPABILITY_TO_ADAPTER.items()},
        "bindings": {name: {"operation": name} for name in (
            "tenant", "domain", "dns", "site", "tls", "mail", "crm_whatsapp", "acceptance"
        )},
    }


def run_to_terminal(service, store, job_id):
    for _ in range(16):
        state = store.get(job_id).state
        if state in {State.HANDOVER_READY.value, State.BLOCKED.value}:
            return state
        service.worker_once()
    raise AssertionError("Provisioner did not reach a terminal state")


class RejectAcceptanceProbe:
    def check(self, _job, _state):
        return False


def main() -> None:
    store = MemoryJobStore()
    queue = JobQueue(store)
    service = ProvisionerService(store, queue, smoke_catalog(), registry())
    request = CreateJobRequest(
        "tenant-smoke", "order-001",
        {"payment_id": "pay-1", "amount": 548, "currency": "ZAR", "verified": True},
    )
    first = service.create_job(request)
    duplicate = service.create_job(request)
    assert first["created"] is True and duplicate["created"] is False

    try:
        service.create_job(CreateJobRequest(
            "tenant-smoke", "order-002",
            {"payment_id": "pay-2", "amount": 1, "currency": "ZAR", "verified": True, "token": "nope"},
        ))
    except ServiceError as error:
        assert error.code == "SECRET_FIELD_REJECTED"
    else:
        raise AssertionError("secret field accepted")

    assert run_to_terminal(service, store, first["job_id"]) == State.HANDOVER_READY.value
    handover = service.handover(first["job_id"])
    assert handover["status"] == "HANDOVER_READY"

    failed_store = MemoryJobStore()
    failed_queue = JobQueue(failed_store)
    rejecting = ProvisionerService(
        failed_store, failed_queue, smoke_catalog(), registry(),
        acceptance=AcceptanceEngine(RejectAcceptanceProbe()),
    )
    failed = rejecting.create_job(CreateJobRequest(
        "tenant-fail", "order-002",
        {"payment_id": "pay-2", "amount": 100, "currency": "ZAR", "verified": True},
    ))
    assert run_to_terminal(rejecting, failed_store, failed["job_id"]) == State.BLOCKED.value
    try:
        rejecting.handover(failed["job_id"])
    except ServiceError as error:
        assert error.code == "HANDOVER_NOT_READY"
    else:
        raise AssertionError("failed acceptance reached handover")

    print("PROVISIONER_E2E_SMOKE: PASS")


if __name__ == "__main__":
    main()
