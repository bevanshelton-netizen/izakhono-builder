#!/usr/bin/env python3
"""Provider-neutral, append-only deployment observability primitives."""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Callable, Optional
import json


@dataclass(frozen=True)
class RuntimeEvent:
    deployment_id: str
    workload: str
    event_type: str
    state: str
    node: Optional[str]
    detail: str
    observed_at: str
    evidence: bool = False

    @classmethod
    def create(cls, deployment_id: str, workload: str, event_type: str,
               state: str, node: Optional[str], detail: str,
               evidence: bool = False) -> "RuntimeEvent":
        return cls(deployment_id, workload, event_type, state, node, detail,
                   datetime.now(timezone.utc).isoformat(), evidence)


class JsonlEventSink:
    """Append-only sink suitable for local/node runtime evidence collection."""
    def __init__(self, writer: Callable[[str], None]):
        self.writer = writer

    def emit(self, event: RuntimeEvent) -> None:
        self.writer(json.dumps(asdict(event), sort_keys=True))


class MemoryEventSink:
    def __init__(self) -> None:
        self.events: list[RuntimeEvent] = []

    def emit(self, event: RuntimeEvent) -> None:
        self.events.append(event)


def heartbeat(deployment_id: str, workload: str, node: str,
              healthy: bool) -> RuntimeEvent:
    return RuntimeEvent.create(
        deployment_id, workload, "heartbeat", "HEALTHY" if healthy else "UNHEALTHY",
        node, "runtime heartbeat observed", evidence=False,
    )


def reconciliation_event(deployment_id: str, workload: str, state: str,
                         node: Optional[str], detail: str) -> RuntimeEvent:
    return RuntimeEvent.create(
        deployment_id, workload, "reconciliation", state, node, detail,
        evidence=False,
    )


def acceptance_evidence_event(deployment_id: str, workload: str, state: str,
                              node: Optional[str], detail: str) -> RuntimeEvent:
    """Record supplied acceptance evidence; does not promote deployment."""
    return RuntimeEvent.create(
        deployment_id, workload, "acceptance_evidence", state, node, detail,
        evidence=True,
    )
