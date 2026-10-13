from __future__ import annotations
import hashlib, json
from dataclasses import dataclass, field
from typing import Any, Callable
from .models import Risk, Task
from .policy import Policy

@dataclass(frozen=True)
class ToolRequest:
    task_id: str
    tool_name: str
    arguments: dict[str, Any] = field(default_factory=dict)
    risk: Risk = Risk.READ
    correlation_id: str | None = None
    approval_granted: bool = False

@dataclass(frozen=True)
class ToolResult:
    task_id: str
    tool_name: str
    status: str
    output: Any = None
    error: str | None = None
    evidence_hash: str = ""

@dataclass(frozen=True)
class ToolSpec:
    name: str
    risk: Risk
    handler: Callable[[dict[str, Any]], Any]

class ToolFabric:
    """Allowlisted tool execution boundary with policy and evidence receipts."""
    def __init__(self, policy: Policy | None = None) -> None:
        self.policy = policy or Policy()
        self._tools: dict[str, ToolSpec] = {}
    def register(self, spec: ToolSpec) -> None:
        if spec.name in self._tools: raise ValueError(f"tool already registered: {spec.name}")
        self._tools[spec.name] = spec
    def execute(self, request: ToolRequest) -> ToolResult:
        spec = self._tools.get(request.tool_name)
        if spec is None: return self._result(request, "blocked", error="tool is not registered")
        if spec.risk is not request.risk: return self._result(request, "blocked", error="requested risk does not match registered tool risk")
        task = Task(request.task_id, request.tool_name, f"Execute allowlisted tool: {request.tool_name}", request.tool_name, risk=spec.risk)
        decision = self.policy.evaluate(task)
        if not decision.allowed: return self._result(request, "blocked", error=decision.reason)
        if decision.approval_required and not request.approval_granted: return self._result(request, "approval_required", error=decision.reason)
        try: return self._result(request, "completed", output=spec.handler(dict(request.arguments)))
        except Exception as exc: return self._result(request, "failed", error=str(exc))
    @staticmethod
    def _result(request: ToolRequest, status: str, output: Any = None, error: str | None = None) -> ToolResult:
        payload={"task_id":request.task_id,"tool_name":request.tool_name,"status":status,"output":output,"error":error,"correlation_id":request.correlation_id}
        evidence=hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
        return ToolResult(request.task_id,request.tool_name,status,output,error,evidence)
