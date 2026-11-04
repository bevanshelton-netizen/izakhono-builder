#!/usr/bin/env python3
"""Deterministic, in-memory Provisioner service-boundary acceptance tests.

All adapters below are test fixtures. They do not contact providers or create
real domains, DNS records, websites, mailboxes, payments or customer accounts.
"""
from __future__ import annotations

from adapter_catalog import CAPABILITY_TO_ADAPTER
from errors import ServiceError
from job_queue import JobQueue
from job_store import MemoryJobStore, utc_now
from service import CreateJobRequest, ProvisionerService
from worker_runtime import STATE_CAPABILITY


def fixture(adapter_name):
    def execute(request):
        capability = request["capability"]
        return {
            "evidence_id": f"fixture-{adapter_name}-{request['operation_id']}",
            "observed_at": utc_now(),
            "verified": True,
            "checks": [f"contract.{capability}"],
        }
    return execute


def build_service():
    store = MemoryJobStore()
    queue = JobQueue(store)
    registry = {
        "adapters": {
            capability: {"owned": adapter}
            for capability, adapter in CAPABILITY_TO_ADAPTER.items()
        },
        "bindings": {
            name: {"operation": "contract-test"}
            for name in set(STATE_CAPABILITY.values())
        },
    }
    implementations = {
        name: fixture(name) for name in set(CAPABILITY_TO_ADAPTER.values())
    }
    return store, ProvisionerService(store, queue, implementations, registry)


def expect_error(code, callback):
    try:
        callback()
    except ServiceError as error:
        assert error.code == code, f"expected {code}, received {error.code}"
        return
    raise AssertionError(f"expected service error {code}")


def main():
    store, service = build_service()
    request = CreateJobRequest(
        "tenant-smoke",
        "order-001",
        {"payment_id": "pay-1", "amount": 548, "currency": "ZAR", "verified": True},
    )

    first = service.create_job(request)
    duplicate = service.create_job(request)
    assert first["created"] is True
    assert duplicate["created"] is False
    assert first["job_id"] == duplicate["job_id"]

    # Isolate the second tenant in its own queue so this assertion does not
    # interleave two independent jobs in the first customer's execution test.
    _, other_service = build_service()
    other_tenant = other_service.create_job(
        CreateJobRequest(
            "tenant-other",
            "order-001",
            {"payment_id": "pay-2", "amount": 548, "currency": "ZAR", "verified": True},
        )
    )
    assert other_tenant["job_id"] != first["job_id"]

    expect_error(
        "PAYMENT_NOT_VERIFIED",
        lambda: service.create_job(
            CreateJobRequest(
                "tenant-smoke",
                "unverified-order",
                {"payment_id": "pay-3", "amount": 1, "currency": "ZAR", "verified": False},
            )
        ),
    )
    expect_error(
        "SECRET_FIELD_REJECTED",
        lambda: service.create_job(
            CreateJobRequest(
                "tenant-smoke",
                "secret-order",
                {
                    "payment_id": "pay-4",
                    "amount": 1,
                    "currency": "ZAR",
                    "verified": True,
                    "token": "must-not-be-persisted",
                },
            )
        ),
    )
    expect_error("HANDOVER_NOT_READY", lambda: service.handover(first["job_id"]))

    cycle_states = []
    for _ in range(9):
        result = service.worker_once()
        cycle_states.append(result["state"] if result else "NO_JOB")

    status = service.status(first["job_id"])
    audit_failures = [
        event.data for event in store.events
        if event.job_id == first["job_id"] and event.event_type in {"RETRY_SCHEDULED", "BLOCKED"}
    ]
    assert status["state"] == "HANDOVER_READY", {
        "state": status["state"],
        "cycle_states": cycle_states,
        "attempts": status["attempts"],
        "audit_failures": audit_failures,
    }
    handover = service.handover(first["job_id"])
    assert handover["status"] == "HANDOVER_READY"
    assert any(event.event_type == "HANDOVER_COMPLETED" for event in store.events)

    print("PROVISIONER_E2E_SMOKE: PASS")


if __name__ == "__main__":
    main()
