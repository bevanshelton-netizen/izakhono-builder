from __future__ import annotations

from dataclasses import dataclass
from .models import Risk, Task


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str
    approval_required: bool = False


class Policy:
    """Fail-closed policy for autonomous execution."""

    def evaluate(self, task: Task) -> Decision:
        if task.risk is Risk.DESTRUCTIVE:
            return Decision(False, "destructive actions require explicit owner approval")
        if task.risk is Risk.EXTERNAL:
            return Decision(True, "external side effect requires evidence and adapter authorization", True)
        if task.approval_required:
            return Decision(True, "task explicitly requires approval", True)
        return Decision(True, "allowed by baseline policy")
