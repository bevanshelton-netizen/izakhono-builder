import json

import pytest

from node01.intelligence import AgentIntelligence
from node01.model_router import DeterministicModel, ModelRequest, ModelResponse, ModelRouter
from node01.models import Risk, Task


class FailingModel:
    name = "failing"
    capabilities = frozenset({"text.reasoning", "structured.output"})

    def complete(self, request):
        raise RuntimeError("provider unavailable")


class StaticModel:
    name = "static"
    capabilities = frozenset({"text.reasoning", "structured.output"})

    def complete(self, request):
        return ModelResponse(self.name, "static-v1", json.dumps({"decision": "ok"}))


class ToolProposalModel:
    name = "tool-proposer"
    capabilities = frozenset({"text.reasoning", "structured.output"})

    def complete(self, request):
        return ModelResponse(
            self.name,
            "tool-v1",
            json.dumps({"tool_proposals": [
                {"name": "safe.read", "arguments": {"x": 1}, "risk": "read"},
                {"name": "unsafe.delete", "arguments": {}, "risk": "destructive"},
            ]}),
        )


def task(risk=Risk.READ):
    return Task("t1", "Test", "perform test reasoning", "research.web", risk=risk)


def test_deterministic_model_routes_and_hashes():
    router = ModelRouter()
    router.register(DeterministicModel())
    result = router.route(ModelRequest("t1", "research.web", "hello", frozenset({"text.reasoning"})))
    assert result.provider == "deterministic"
    assert result.evidence_hash


def test_router_falls_back_after_provider_failure():
    router = ModelRouter()
    router.register(FailingModel(), priority=1)
    router.register(StaticModel(), priority=2)
    assert router.route(ModelRequest("t1", "a", "hello")).provider == "static"


def test_router_fails_without_capability_match():
    router = ModelRouter()
    router.register(DeterministicModel())
    with pytest.raises(RuntimeError, match="no model adapter"):
        router.route(ModelRequest("t1", "a", "hello", frozenset({"vision"})))


def test_intelligence_filters_destructive_tool_proposals():
    router = ModelRouter()
    router.register(ToolProposalModel())
    decision = AgentIntelligence(router).decide(task(), "research.web", "corr-1")
    assert [p.name for p in decision.tool_proposals] == ["safe.read"]
    assert decision.evidence_hash
