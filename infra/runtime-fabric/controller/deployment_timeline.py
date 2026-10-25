#!/usr/bin/env python3
"""Read-only deployment timeline projection from runtime events."""
from __future__ import annotations

from dataclasses import asdict
from typing import Iterable

from observability import RuntimeEvent


class DeploymentTimeline:
    """Build an auditable chronological view without changing deployment state."""

    def __init__(self, events: Iterable[RuntimeEvent] = ()):
        self._events = list(events)

    def add(self, event: RuntimeEvent) -> None:
        self._events.append(event)

    def for_deployment(self, deployment_id: str) -> list[dict]:
        events = [e for e in self._events if e.deployment_id == deployment_id]
        events.sort(key=lambda e: e.observed_at)
        return [asdict(e) for e in events]

    def has_acceptance_evidence(self, deployment_id: str) -> bool:
        return any(
            e.deployment_id == deployment_id and e.event_type == "acceptance_evidence"
            and e.evidence for e in self._events
        )

    def is_live_verified(self, deployment_id: str) -> bool:
        # Observability is never authoritative for promotion.
        return False
