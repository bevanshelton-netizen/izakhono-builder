from adapter_catalog import CAPABILITY_TO_ADAPTER
from adapter_registry_runtime import load_registry
from job_queue import JobQueue
from state_machine import State
from job_store import MemoryJobStore, utc_now
from worker_runtime import ProvisionerWorker


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


def main():
    implementations = {
        name: fixture(name)
        for name in set(CAPABILITY_TO_ADAPTER.values())
    }
    store = MemoryJobStore()
    queue = JobQueue(store)
    job, created = store.create_or_get("tenant-ci", "idem-ci", "prov-ci")
    assert created is True
    replay, replay_created = store.create_or_get("tenant-ci", "idem-ci", "prov-ci")
    assert replay_created is False
    assert replay.job_id == job.job_id

    job.evidence[State.PAYMENT_VERIFIED.value] = {
        "evidence_id": "payment-ci",
        "observed_at": utc_now(),
        "verified": True,
        "checks": ["payment.verified"],
    }
    store.save(job)
    queue.enqueue(job)

    worker = ProvisionerWorker(store, queue, implementations, load_registry())
    for _ in range(9):
        worker.run_once()

    assert job.state == State.HANDOVER_READY.value, job.state
    assert job.evidence[State.PAYMENT_VERIFIED.value]["verified"] is True
    print("DETERMINISTIC_RUNTIME: PASS")


if __name__ == "__main__":
    main()
