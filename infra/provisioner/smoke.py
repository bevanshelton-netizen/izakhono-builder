#!/usr/bin/env python3
"""Deterministic end-to-end Provisioner service contract smoke tests."""
from __future__ import annotations

from acceptance_engine import AcceptanceEngine, EvidenceAcceptanceProbe
from adapter_catalog import CAPABILITY_TO_ADAPTER
from job_queue import JobQueue
from job_store import MemoryJobStore, utc_now
from service import CreateJobRequest, ProvisionerService, ServiceError
from state_machine import State


def build_registry():
    capabilities = ("tenant", "domain", "dns", "site", "tls", "mail", "crm_whatsapp", "acceptance")
    return {
        "adapters": {name: {"owned": CAPABILITY_TO_ADAPTER[name]} for name in capabilities},
        "bindings": {name: {"operation": "smoke"} for name in capabilities},
    }


def build_implementations():
    def verified(request):
        return {
            "verified": True,
            "simulation": False,
            "evidence_id": f"ev_{request['operation_id']}",
            "observed_at": utc_now(),
            "checks": [f"{request['capability']}.verified"],
        }
    return {CAPABILITY_TO_ADAPTER[name]: verified for name in (
        "tenant", "domain", "dns", "site", "tls", "mail", "crm_whatsapp", "acceptance"
    )}


class RejectAcceptanceProbe:
    def check(self, _job, _state):
        return False


def main() -> None:
    store = MemoryJobStore()
    queue = JobQueue(store)
    service = ProvisionerService(
        store, queue, build_implementations(), build_registry(),
        acceptance=AcceptanceEngine(EvidenceAcceptanceProbe()),
    )
    req = CreateJobRequest(
        "tenant-smoke", "order-001",
        {"payment_id": "pay-1", "amount": 548, "currency": "ZAR", "verified": True},
    )
    first = service.create_job(req)
    duplicate = service.create_job(req)
    assert first["created"] is True and duplicate["created"] is False

    try:
        service.create_job(CreateJobRequest(
            "tenant-smoke", "order-002",
            {"payment_id": "pay-2", "amount": 1, "currency": "ZAR", "verified": True, "token": "nope"},
        ))
    except ServiceError as exc:
        assert exc.code == "SECRET_FIELD_REJECTED"
    else:
        raise AssertionError("secret field accepted")

    for _ in range(12):
        service.worker_once()
        current = service.status(first["job_id"])
        if current["state"] in {State.HANDOVER_READY.value, State.BLOCKED.value}:
            break
    assert current["state"] == State.HANDOVER_READY.value, current
    handover = service.handover(first["job_id"])
    assert handover["status"] == "HANDOVER_READY"

    failed_store = MemoryJobStore()
    failed_queue = JobQueue(failed_store)
    failing = ProvisionerService(
        failed_store, failed_queue, build_implementations(), build_registry(),
        acceptance=AcceptanceEngine(RejectAcceptanceProbe()),
    )
    created = failing.create_job(CreateJobRequest(
        "tenant-fail", "order-003",
        {"payment_id": "pay-3", "amount": 100, "currency": "ZAR", "verified": True},
    ))
    for _ in range(12):
        failing.worker_once()
        rejected = failing.status(created["job_id"])
        if rejected["state"] in {State.HANDOVER_READY.value, State.BLOCKED.value}:
            break
    assert rejected["state"] == State.BLOCKED.value, rejected
    try:
        failing.handover(created["job_id"])
    except ServiceError as exc:
        assert exc.code == "HANDOVER_NOT_READY"
    else:
        raise AssertionError("failed acceptance reached handover")

    print("PROVISIONER_E2E_SMOKE: PASS")


if __name__ == "__main__":
    main()
