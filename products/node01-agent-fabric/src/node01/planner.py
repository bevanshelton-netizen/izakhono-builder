from __future__ import annotations

import re
from .models import Risk, Task


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48] or "objective"


def plan(objective: str) -> list[Task]:
    """Create a safe baseline graph. Provider/model planners can enrich this later."""
    key = _slug(objective)
    tasks = [
        Task(f"{key}.scope", "Scope objective", objective, "product.strategy"),
        Task(f"{key}.research", "Research relevant context", objective, "research.web", [f"{key}.scope"]),
        Task(f"{key}.plan", "Create execution plan", objective, "product.plan", [f"{key}.scope", f"{key}.research"]),
        Task(f"{key}.security", "Review security implications", objective, "security.audit", [f"{key}.plan"]),
        Task(f"{key}.build", "Prepare implementation work", objective, "build.frontend", [f"{key}.plan"], risk=Risk.WRITE, resource_locks=["workspace"]),
        Task(f"{key}.qa", "Validate implementation", objective, "qa.acceptance", [f"{key}.build", f"{key}.security"]),
        Task(f"{key}.release", "Prepare release candidate", objective, "release.prepare", [f"{key}.qa"], risk=Risk.WRITE, resource_locks=["release"]),
        Task(f"{key}.review", "Perform final evidence review", objective, "review.evidence", [f"{key}.release"]),
    ]
    return tasks
