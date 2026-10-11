from __future__ import annotations

import asyncio
import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class Envelope:
    kind: str
    payload: dict[str, Any]
    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: float = field(default_factory=time.time)


class AIGateway(Protocol):
    async def complete(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]: ...


class Queue(Protocol):
    async def publish(self, envelope: Envelope) -> None: ...
    async def consume(self) -> Envelope: ...


class Observer(Protocol):
    async def record(self, event: Envelope, outcome: dict[str, Any]) -> None: ...


class Mail(Protocol):
    async def draft(self, recipient: str, subject: str, body: str) -> dict[str, Any]: ...


class Provisioner(Protocol):
    async def plan(self, request: dict[str, Any]) -> dict[str, Any]: ...


class DeterministicGateway:
    """Safe local gateway. Replace with a provider adapter at the boundary."""
    async def complete(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        digest = hashlib.sha256(json.dumps({"prompt": prompt, "context": context}, sort_keys=True).encode()).hexdigest()
        return {"mode": "deterministic", "summary": prompt, "context_keys": sorted(context), "trace": digest}


class InMemoryQueue:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[Envelope] = asyncio.Queue()

    async def publish(self, envelope: Envelope) -> None:
        await self._queue.put(envelope)

    async def consume(self) -> Envelope:
        return await self._queue.get()


class InMemoryObserver:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    async def record(self, event: Envelope, outcome: dict[str, Any]) -> None:
        self.events.append({"kind": event.kind, "correlation_id": event.correlation_id, "outcome": outcome})


class DraftMail:
    """Never sends. Produces a reviewable outbound-mail artifact."""
    async def draft(self, recipient: str, subject: str, body: str) -> dict[str, Any]:
        return {"status": "draft", "recipient": recipient, "subject": subject, "body": body}


class ProvisionerPlan:
    """Produces a provisioning plan; execution remains behind an explicit external adapter."""
    async def plan(self, request: dict[str, Any]) -> dict[str, Any]:
        required = ["domain", "dns", "tls", "hosting", "email", "crm", "forms", "payments"]
        return {
            "status": "plan_ready",
            "domain": request.get("domain"),
            "steps": [{"name": item, "status": "pending_external_adapter"} for item in required],
            "owned_first": True,
            "rollback_required": True,
        }


@dataclass
class Node01ControlPlane:
    gateway: AIGateway = field(default_factory=DeterministicGateway)
    queue: Queue = field(default_factory=InMemoryQueue)
    observer: Observer = field(default_factory=InMemoryObserver)
    mail: Mail = field(default_factory=DraftMail)
    provisioner: Provisioner = field(default_factory=ProvisionerPlan)

    async def submit(self, kind: str, payload: dict[str, Any]) -> Envelope:
        envelope = Envelope(kind, payload)
        await self.queue.publish(envelope)
        await self.observer.record(envelope, {"status": "queued"})
        return envelope

    async def dispatch_once(self) -> dict[str, Any]:
        event = await self.queue.consume()
        if event.kind == "ai.complete":
            result = await self.gateway.complete(event.payload.get("prompt", ""), event.payload.get("context", {}))
        elif event.kind == "mail.draft":
            result = await self.mail.draft(event.payload["recipient"], event.payload["subject"], event.payload["body"])
        elif event.kind == "provision.plan":
            result = await self.provisioner.plan(event.payload)
        else:
            result = {"status": "unhandled", "kind": event.kind}
        await self.observer.record(event, result)
        return {"correlation_id": event.correlation_id, "kind": event.kind, "result": result}


async def demo_cycle() -> list[dict[str, Any]]:
    cp = Node01ControlPlane()
    await cp.submit("ai.complete", {"prompt": "classify objective", "context": {"source": "node01"}})
    await cp.submit("provision.plan", {"domain": "example.invalid"})
    return [await cp.dispatch_once(), await cp.dispatch_once()]
