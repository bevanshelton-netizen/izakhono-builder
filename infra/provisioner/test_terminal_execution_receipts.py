"""Submission idempotency and terminal receipt regression tests."""
from __future__ import annotations

from acceptance_engine import AcceptanceEngine, EvidenceAcceptanceProbe, OPERATIONAL_STATES
from execution_receipt import build_terminal_receipt
from job_queue import JobQueue
from job_store import MemoryJobStore, utc_now
from service import CreateJobRequest, ProvisionerService, ServiceError
from worker_runtime import ProvisionerWorker


def payment(payment_id: str) -> dict:
    return {"payment_id": payment_id, "amount": "548.00", "currency": "ZAR", "verified": True}


def test_idempotency_replays_and_rejects_payload_conflicts() -> None:
    store = MemoryJobStore()
    queue = JobQueue(store)
    service = ProvisionerService(store, queue)
    first = service.create_job(CreateJobRequest("tenant-a", "order-1", payment("pay-1")))
    replay = service.create_job(CreateJobRequest("tenant-a", "order-1", payment("pay-1")))
    assert first["created"] is True
    assert replay["created"] is False
    assert first["job_id"] == replay["job_id"]
    try:
        service.create_job(CreateJobRequest("tenant-a", "order-1", payment("pay-different")))
    except ServiceError as error:
        assert error.code == "IDEMPOTENCY_CONFLICT"
    else:
        raise AssertionError("same idempotency key accepted a different request")
    other_tenant = service.create_job(CreateJobRequest("tenant-b", "order-1", payment("pay-1")))
    assert other_tenant["job_id"] != first["job_id"]


def test_failed_job_persists_terminal_receipt_and_audit() -> None:
    store = MemoryJobStore()
    queue = JobQueue(store)
    job, _ = store.create_or_get("tenant-fail", "idem-fail", "job-fail")
    worker = ProvisionerWorker(store, queue, {}, {})
    result = worker._block(job, "ADAPTER_UNAVAILABLE", "adapter unavailable")
    assert result.status == "blocked"
    receipt = job.evidence["TERMINAL_RECEIPT"]
    assert receipt["status"] == "FAILED"
    assert receipt["terminal_state"] == "BLOCKED"
    assert receipt["job_id"] == job.job_id
    assert any(event.event_type == "TERMINAL_RECEIPT" for event in store.events)


def test_successful_job_persists_terminal_receipt() -> None:
    store = MemoryJobStore()
    queue = JobQueue(store)
    job, _ = store.create_or_get("tenant-ok", "idem-ok", "job-ok")
    for state in OPERATIONAL_STATES:
        job.evidence[state] = {
            "evidence_id": f"ev-{state.lower()}",
            "observed_at": utc_now(),
            "verified": True,
            "checks": [f"{state.lower()}.verified"],
            "simulation": False,
        }
    worker = ProvisionerWorker(store, queue, {}, {}, acceptance=AcceptanceEngine(EvidenceAcceptanceProbe()))
    result = worker._accept(job)
    assert result.status == "accepted"
    receipt = job.evidence["TERMINAL_RECEIPT"]
    assert receipt["status"] == "SUCCEEDED"
    assert receipt["terminal_state"] == "HANDOVER_READY"
    assert any(event.event_type == "TERMINAL_RECEIPT" for event in store.events)


def test_receipt_identity_is_bound_to_evidence() -> None:
    store = MemoryJobStore()
    job, _ = store.create_or_get("tenant", "idem", "job-receipt")
    job.state = "BLOCKED"
    job.evidence["MAIL_READY"] = {"verified": False, "evidence_id": "ev-1"}
    first, _ = build_terminal_receipt(job)
    second, _ = build_terminal_receipt(job)
    assert first["receipt_id"] == second["receipt_id"]
    job.evidence["MAIL_READY"] = {"verified": True, "evidence_id": "ev-2"}
    changed, _ = build_terminal_receipt(job)
    assert changed["receipt_id"] != first["receipt_id"]


if __name__ == "__main__":
    test_idempotency_replays_and_rejects_payload_conflicts()
    test_failed_job_persists_terminal_receipt_and_audit()
    test_successful_job_persists_terminal_receipt()
    test_receipt_identity_is_bound_to_evidence()
    print("PROVISIONER_TERMINAL_RECEIPT_TESTS: PASS")
