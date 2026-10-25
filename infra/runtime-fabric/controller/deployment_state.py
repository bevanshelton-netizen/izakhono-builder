#!/usr/bin/env python3
"""Persistent, idempotent deployment state machine for IZAKHONO Runtime Fabric.

State transitions are deterministic and fail closed. Persistence is deliberately
abstracted behind a tiny store interface so production storage can be PostgreSQL,
file-backed state, or another owned durable store without changing orchestration.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Mapping, MutableMapping, Optional

TERMINAL = {"LIVE_VERIFIED", "ROLLED_BACK", "FAILED"}
ALLOWED = {
    "CREATED": {"PLANNED", "FAILED"},
    "PLANNED": {"ACTIVATING", "FAILED"},
    "ACTIVATING": {"DEPLOYED", "ROLLBACK_REQUIRED", "FAILED"},
    "DEPLOYED": {"HEALTH_CHECKING", "ROLLBACK_REQUIRED", "FAILED"},
    "HEALTH_CHECKING": {"ACCEPTANCE_PENDING", "ROLLBACK_REQUIRED", "FAILED"},
    "ACCEPTANCE_PENDING": {"READY_FOR_PROMOTION", "ROLLBACK_REQUIRED", "FAILED"},
    "READY_FOR_PROMOTION": {"LIVE_VERIFIED", "ROLLBACK_REQUIRED", "FAILED"},
    "ROLLBACK_REQUIRED": {"ROLLING_BACK", "FAILED"},
    "ROLLING_BACK": {"ROLLED_BACK", "FAILED"},
}


@dataclass
class DeploymentRecord:
    deployment_id: str
    workload: str
    state: str = "CREATED"
    node: Optional[str] = None
    checkpoint: Optional[str] = None
    attempts: int = 0
    metadata: Dict[str, str] = field(default_factory=dict)


class MemoryDeploymentStore:
    """Deterministic store used by unit tests and local orchestration."""
    def __init__(self) -> None:
        self.records: MutableMapping[str, DeploymentRecord] = {}

    def get(self, deployment_id: str) -> Optional[DeploymentRecord]:
        return self.records.get(deployment_id)

    def put(self, record: DeploymentRecord) -> DeploymentRecord:
        self.records[record.deployment_id] = record
        return record


def transition(record: DeploymentRecord, target: str) -> DeploymentRecord:
    if record.state == target:
        return record
    if record.state in TERMINAL:
        raise ValueError(f"terminal deployment cannot transition: {record.state}")
    if target not in ALLOWED.get(record.state, set()):
        raise ValueError(f"invalid deployment transition: {record.state} -> {target}")
    record.state = target
    return record


def ensure_deployment(store: MemoryDeploymentStore, deployment_id: str, workload: str) -> DeploymentRecord:
    existing = store.get(deployment_id)
    if existing:
        if existing.workload != workload:
            raise ValueError("deployment id is already bound to another workload")
        return existing
    return store.put(DeploymentRecord(deployment_id=deployment_id, workload=workload))


def checkpoint(record: DeploymentRecord, name: str) -> DeploymentRecord:
    if not name:
        raise ValueError("checkpoint name is required")
    record.checkpoint = name
    return record


def resume(store: MemoryDeploymentStore, deployment_id: str) -> DeploymentRecord:
    record = store.get(deployment_id)
    if record is None:
        raise KeyError(deployment_id)
    # Resume returns durable state; orchestration decides the next safe action.
    return record
