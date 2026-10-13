from node01.models import Risk
from node01.tool_fabric import ToolFabric, ToolRequest, ToolSpec


def test_registered_read_tool_executes_and_has_evidence():
    fabric = ToolFabric()
    fabric.register(ToolSpec("echo", Risk.READ, lambda args: args["value"]))
    result = fabric.execute(ToolRequest("t1", "echo", {"value": "ok"}, Risk.READ, "c1"))
    assert result.status == "completed"
    assert result.output == "ok"
    assert result.evidence_hash


def test_unknown_tool_is_blocked():
    result = ToolFabric().execute(ToolRequest("t1", "missing"))
    assert result.status == "blocked"


def test_destructive_tool_is_blocked():
    fabric = ToolFabric()
    fabric.register(ToolSpec("delete", Risk.DESTRUCTIVE, lambda _: "deleted"))
    result = fabric.execute(ToolRequest("t1", "delete", risk=Risk.DESTRUCTIVE))
    assert result.status == "blocked"


def test_external_tool_requires_approval():
    fabric = ToolFabric()
    fabric.register(ToolSpec("publish", Risk.EXTERNAL, lambda _: "published"))
    result = fabric.execute(ToolRequest("t1", "publish", risk=Risk.EXTERNAL))
    assert result.status == "approval_required"


def test_risk_mismatch_is_blocked():
    fabric = ToolFabric()
    fabric.register(ToolSpec("echo", Risk.READ, lambda _: "ok"))
    result = fabric.execute(ToolRequest("t1", "echo", risk=Risk.WRITE))
    assert result.status == "blocked"
