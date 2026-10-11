from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Risk(str, Enum):
    READ = "read"
    WRITE = "write"
    EXTERNAL = "external"
    DESTRUCTIVE = "destructive"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"
    SKIPPED = "skipped"


@dataclass(frozen=True)
class AgentSpec:
    id: str
    name: str
    domain: str
    capabilities: frozenset[str]
    max_concurrency: int = 1
    risks: frozenset[Risk] = frozenset({Risk.READ})


@dataclass
class Task:
    id: str
    title: str
    description: str
    capability: str
    depends_on: list[str] = field(default_factory=list)
    risk: Risk = Risk.READ
    approval_required: bool = False
    resource_locks: list[str] = field(default_factory=list)
    input: dict[str, Any] = field(default_factory=dict)


@dataclass
class TaskResult:
    task_id: str
    status: TaskStatus
    agent_id: str | None
    output: dict[str, Any] = field(default_factory=dict)
    evidence: list[str] = field(default_factory=list)
    error: str | None = None


@dataclass
class ExecutionReceipt:
    execution_id: str
    objective: str
    started_at: str
    completed_at: str | None
    status: str
    tasks: list[TaskResult]
    policy_decisions: list[dict[str, Any]]
    receipt_hash: str | None = None
