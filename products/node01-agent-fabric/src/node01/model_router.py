from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class ModelRequest:
    task_id: str
    agent_id: str
    prompt: str
    required_capabilities: frozenset[str] = frozenset()
    correlation_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ModelResponse:
    provider: str
    model: str
    content: str
    finish_reason: str = "stop"
    usage: dict[str, int] = field(default_factory=dict)
    evidence_hash: str = ""


class ModelAdapter(Protocol):
    name: str
    capabilities: frozenset[str]

    def complete(self, request: ModelRequest) -> ModelResponse:
        ...


def _evidence_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class ModelRouter:
    """Provider-neutral, capability-aware model routing with bounded fallback."""

    def __init__(self) -> None:
        self._adapters: list[tuple[int, ModelAdapter]] = []

    def register(self, adapter: ModelAdapter, priority: int = 100) -> None:
        self._adapters.append((priority, adapter))
        self._adapters.sort(key=lambda item: item[0])

    def route(self, request: ModelRequest) -> ModelResponse:
        candidates = [
            adapter for _, adapter in self._adapters
            if request.required_capabilities.issubset(adapter.capabilities)
        ]
        if not candidates:
            raise RuntimeError("no model adapter satisfies required capabilities")

        failures: list[str] = []
        for adapter in candidates:
            try:
                response = adapter.complete(request)
                payload = {
                    "task_id": request.task_id,
                    "agent_id": request.agent_id,
                    "correlation_id": request.correlation_id,
                    "provider": response.provider,
                    "model": response.model,
                    "content": response.content,
                    "finish_reason": response.finish_reason,
                    "usage": response.usage,
                }
                return ModelResponse(
                    provider=response.provider,
                    model=response.model,
                    content=response.content,
                    finish_reason=response.finish_reason,
                    usage=response.usage,
                    evidence_hash=_evidence_hash(payload),
                )
            except Exception as exc:
                failures.append(f"{adapter.name}: {exc}")
        raise RuntimeError("all model adapters failed: " + " | ".join(failures))


@dataclass(frozen=True)
class DeterministicModel:
    """Offline reference adapter used for tests and safe bootstrap operation."""

    name: str = "deterministic"
    model: str = "reference-v1"
    capabilities: frozenset[str] = frozenset({"text.reasoning", "structured.output"})

    def complete(self, request: ModelRequest) -> ModelResponse:
        content = json.dumps({
            "decision": "accepted",
            "task_id": request.task_id,
            "agent_id": request.agent_id,
            "prompt": request.prompt,
            "next_step": "return structured result to the execution boundary",
        }, sort_keys=True)
        return ModelResponse(self.name, self.model, content)
