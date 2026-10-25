#!/usr/bin/env python3
from observability import (
    MemoryEventSink,
    RuntimeEvent,
    acceptance_evidence_event,
    heartbeat,
    reconciliation_event,
)


sink = MemoryEventSink()
sink.emit(heartbeat("dep-1", "kora-mail", "node01", True))
sink.emit(reconciliation_event("dep-1", "kora-mail", "DEPLOYED", "node01", "deployment observed"))
sink.emit(acceptance_evidence_event("dep-1", "kora-mail", "ACCEPTANCE_PENDING", "node01", "external evidence supplied"))

assert len(sink.events) == 3
assert sink.events[0].event_type == "heartbeat"
assert sink.events[0].evidence is False
assert sink.events[2].event_type == "acceptance_evidence"
assert sink.events[2].evidence is True
assert sink.events[2].state != "LIVE_VERIFIED"
assert all(isinstance(event, RuntimeEvent) for event in sink.events)
print("OBSERVABILITY: PASS")
