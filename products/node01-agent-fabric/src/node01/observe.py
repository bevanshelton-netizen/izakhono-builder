from __future__ import annotations

import json
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class Event:
    event_id: str
    event_type: str
    timestamp: float
    source: str
    correlation_id: str
    payload: dict[str, Any] = field(default_factory=dict)


class EventLedger:
    """Thread-safe append-only reference event ledger for NODE01 observation."""

    def __init__(self, max_events: int = 10000) -> None:
        self.max_events = max(100, max_events)
        self._events: list[Event] = []
        self._lock = threading.RLock()

    def append(self, event_type: str, source: str, payload: dict[str, Any] | None = None, correlation_id: str | None = None) -> Event:
        event = Event(str(uuid.uuid4()), event_type, time.time(), source, correlation_id or str(uuid.uuid4()), payload or {})
        with self._lock:
            self._events.append(event)
            if len(self._events) > self.max_events:
                del self._events[: len(self._events) - self.max_events]
        return event

    def recent(self, limit: int = 100) -> list[Event]:
        with self._lock:
            return list(self._events[-max(1, limit):])

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            counts: dict[str, int] = {}
            for event in self._events:
                counts[event.event_type] = counts.get(event.event_type, 0) + 1
            return {"events": len(self._events), "by_type": counts}

    def export_json(self) -> str:
        return json.dumps([asdict(event) for event in self.recent(self.max_events)], sort_keys=True)
