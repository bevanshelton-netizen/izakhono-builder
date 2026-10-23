#!/usr/bin/env python3
"""Deterministic end-to-end Provisioner contract smoke tests."""
from __future__ import annotations
from datetime import datetime, timezone
from job_store import MemoryJobStore
from job_queue import JobQueue
from service import CreateJobRequest, ProvisionerService, ServiceError
from state_machine import State, StepResult

def main() -> None:
    store=MemoryJobStore(); queue=JobQueue(store)
    service=ProvisionerService(store,queue,acceptance_probe=lambda job,state: True)
    req=CreateJobRequest("tenant-smoke","order-001",{"payment_id":"pay-1","amount":548,"currency":"ZAR","verified":True})
    first=service.create_job(req); duplicate=service.create_job(req)
    assert first["created"] is True and duplicate["created"] is False
    try:
        service.create_job(CreateJobRequest("tenant-smoke","order-002",{"payment_id":"pay-2","amount":1,"currency":"ZAR","verified":True,"token":"nope"}))
    except ServiceError as e: assert e.code=="SECRET_FIELD_REJECTED"
    else: raise AssertionError("secret field accepted")

    def executor(job): return StepResult(True,{"verified":True,"observed_at":datetime.now(timezone.utc).isoformat()})
    while store.get(first["job_id"]).state not in {State.HANDOVER_READY.value,State.BLOCKED.value}:
        service.worker_once(executor)
    assert store.get(first["job_id"]).state==State.HANDOVER_READY.value
    handover=service.handover(first["job_id"]); assert handover["status"]=="HANDOVER_READY"

    failed_store=MemoryJobStore(); failed_queue=JobQueue(failed_store)
    failing=ProvisionerService(failed_store,failed_queue,acceptance_probe=lambda job,state: False)
    created=failing.create_job(CreateJobRequest("tenant-fail","order-002",{"payment_id":"pay-2","amount":100,"currency":"ZAR","verified":True}))
    while failed_store.get(created["job_id"]).state!=State.INTEGRATIONS_READY.value: failing.worker_once(executor)
    result=failing.worker_once(executor); assert result["state"]==State.BLOCKED.value
    try: failing.handover(created["job_id"])
    except ServiceError as e: assert e.code=="HANDOVER_NOT_READY"
    else: raise AssertionError("failed acceptance reached handover")
    print("PROVISIONER_E2E_SMOKE: PASS")

if __name__=="__main__": main()
