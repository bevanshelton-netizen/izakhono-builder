from node01.intelligence import AgentIntelligence
from node01.model_router import DeterministicModel, ModelRouter
from node01.models import Task
from node01.observe import EventLedger
from node01.orchestrator import AgentOrchestrator
from node01.tool_fabric import ToolFabric, ToolSpec
from node01.models import Risk


def build_intelligence() -> AgentIntelligence:
    router = ModelRouter()
    router.register(DeterministicModel())
    return AgentIntelligence(router)


def test_orchestration_completes_safe_task_and_records_events() -> None:
    ledger = EventLedger()
    runner = AgentOrchestrator(build_intelligence(), ToolFabric(), ledger)
    task = Task("t1", "Scope", "Define the objective", "product.strategy")
    result = runner.run("Build a safe plan", [task], "corr-1")
    assert result.status == "completed"
    assert result.evidence_hash
    assert result.correlation_id == "corr-1"
    assert any(event["event_type"] == "agent.decision" for event in result.events)


def test_tool_proposal_is_executed_only_when_model_proposes_one() -> None:
    class ProposalModel(DeterministicModel):
        def complete(self, request):
            from node01.model_router import ModelResponse
            import json
            return ModelResponse(self.name, self.model, json.dumps({
                "decision": "accepted",
                "tool_proposals": [{"name": "echo", "arguments": {"value": "ok"}, "risk": "read"}],
            }))

    router = ModelRouter()
    router.register(ProposalModel())
    ledger = EventLedger()
    tools = ToolFabric()
    tools.register(ToolSpec("echo", Risk.READ, lambda args: args["value"]))
    runner = AgentOrchestrator(AgentIntelligence(router), tools, ledger)
    result = runner.run("Use the safe tool", [Task("t2", "Scope", "Use echo", "product.strategy")])
    assert result.status == "completed"
    assert result.turns[0].tool_results[0].output == "ok"
    assert any(event["event_type"] == "tool.result" for event in result.events)


def test_turn_budget_fails_closed() -> None:
    runner = AgentOrchestrator(build_intelligence(), ToolFabric(), max_turns=1)
    tasks = [
        Task("t1", "Scope", "One", "product.strategy"),
        Task("t2", "Scope", "Two", "product.strategy"),
    ]
    result = runner.run("bounded", tasks)
    assert result.status == "blocked_or_failed"
