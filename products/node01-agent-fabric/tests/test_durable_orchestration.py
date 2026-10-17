from node01.durable_orchestration import DurableOrchestration
from node01.intelligence import AgentIntelligence
from node01.model_router import DeterministicModel, ModelRouter
from node01.orchestrator import AgentOrchestrator
from node01.persistent_queue import SQLiteTaskQueue
from node01.tool_fabric import ToolFabric


def runner() -> AgentOrchestrator:
    router = ModelRouter()
    router.register(DeterministicModel())
    return AgentOrchestrator(AgentIntelligence(router), ToolFabric())


def test_submit_persists_and_handler_completes(tmp_path) -> None:
    queue = SQLiteTaskQueue(tmp_path / "node01.db")
    durable = DurableOrchestration(queue, runner())
    submission = durable.submit("Build a safe plan", correlation_id="corr-durable", idempotency_key="job-1")
    assert queue.snapshot()["queued"] == 1
    payload = queue.lease("worker-1", {DurableOrchestration.CAPABILITY})
    assert payload is not None
    result = durable.handler(payload.payload)
    assert result["status"] == "completed"
    queue.complete(payload, result)
    assert queue.snapshot()["completed"] == 1
    queue.close()


def test_duplicate_submission_is_rejected(tmp_path) -> None:
    queue = SQLiteTaskQueue(tmp_path / "node01.db")
    durable = DurableOrchestration(queue, runner())
    durable.submit("Same objective", idempotency_key="same")
    try:
        durable.submit("Same objective", idempotency_key="same")
    except ValueError as exc:
        assert "duplicate idempotency key" in str(exc)
    else:
        raise AssertionError("duplicate submission was accepted")
    queue.close()
