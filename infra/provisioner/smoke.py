#!/usr/bin/env python3
"""Deterministic end-to-end Provisioner contract smoke tests."""
from __future__ import annotations

from job_queue import JobQueue
from job_store import MemoryJobStore
from service import CreateJobRequest, ProvisionerService, ServiceError
from adapter_catalog import CAPABILITY_TO_ADAPTER, build_catalog


def main() -> None:
    store = MemoryJobStore()
    queue = JobQueue(store)
    registry = {
        "adapters": {key: {"owned": value} for key, value in CAPABILITY_TO_ADAPTER.items()},
        "bindings": {
            name: {"operation": "smoke"}
            for name in {"tenant", "domain", "dns", "site", "tls", "mail", "crm_whatsapp", "acceptance"}
        },
    }
    service = ProvisionerService(store, queue, build_catalog(), registry)
    request = CreateJobRequest(
        "tenant-smoke",
        "order-001",
        {"payment_id": "pay-1", "amount": 548, "currency": "ZAR", "verified": True},
    )
    first = service.create_job(request)
    duplicate = service.create_job(request)
    assert first["created"] is True and duplicate["created"] is False
    assert first["job_id"] == duplicate["job_id"]

    try:
        service.create_job(CreateJobRequest(
            "tenant-smoke",
            "order-002",
            {"payment_id": "pay-2", "amount": 1, "currency": "ZAR", "verified": True, "token": "nope"},
        ))
    except ServiceError as error:
        assert error.code == "SECRET_FIELD_REJECTED"
    else:
        raise AssertionError("secret field accepted")

    for _ in range(9):
        service.worker_once()
    assert store.get(first["job_id"]).state == "HANDOVER_READY"
    handover = service.handover(first["job_id"])
    assert handover["status"] == "HANDOVER_READY"
    print("PROVISIONER_E2E_SMOKE: PASS")


if __name__ == "__main__":
    main()
