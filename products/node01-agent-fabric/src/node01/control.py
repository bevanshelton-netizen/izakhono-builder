from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .observe import EventLedger


@dataclass(frozen=True)
class ControlResult:
    action: str
    accepted: bool
    reason: str


class ControlPlane:
    """Fail-closed operator controls for pause, resume, drain and replay."""

    def __init__(self, ledger: EventLedger) -> None:
        self.ledger = ledger
        self.paused = False
        self.draining = False

    def pause(self, reason: str = "operator request") -> ControlResult:
        self.paused = True
        self.ledger.append("control.pause", "operator", {"reason": reason})
        return ControlResult("pause", True, reason)

    def resume(self, reason: str = "operator request") -> ControlResult:
        self.paused = False
        self.ledger.append("control.resume", "operator", {"reason": reason})
        return ControlResult("resume", True, reason)

    def drain(self, reason: str = "operator request") -> ControlResult:
        self.draining = True
        self.ledger.append("control.drain", "operator", {"reason": reason})
        return ControlResult("drain", True, reason)

    def replay(self, task_id: str, *, approved: bool = False) -> ControlResult:
        if not approved:
            self.ledger.append("control.replay.denied", "operator", {"task_id": task_id})
            return ControlResult("replay", False, "explicit approval required")
        self.ledger.append("control.replay", "operator", {"task_id": task_id})
        return ControlResult("replay", True, "approved")

    def status(self) -> dict[str, Any]:
        return {"paused": self.paused, "draining": self.draining, "events": self.ledger.snapshot()}
