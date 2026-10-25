#!/usr/bin/env python3
"""Persistent, idempotent deployment state machine for IZAKHONO Runtime Fabric."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, MutableMapping, Optional

from observability import RuntimeEvent

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

def transition(record: DeploymentRecord, target: str, event_sink=None) -> DeploymentRecord:
    if record.state == target:
        return record
    if record.state in TERMINAL:
        raise ValueError(f"terminal deployment cannot transition: {record.state}")
    if target not in ALLOWED.get(record.state, set()):
        raise ValueError(f"invalid deployment transition: {record.state} -> {target}")
    previous = record.state
    record.state = target
    if event_sink is not None:
        event_sink.emit(RuntimeEvent.create(
            record.deployment_id, record.workload, "state_transition", record.state,
            record.node, f"{previous} -> {record.state}: deployment state transition",
            evidence=False,
        ))
    return record

def ensure_deployment(store: MemoryDeploymentStore, deployment_id: str, workload: str) -> DeploymentRecord:
    existing = store.get(deployment_id)
    if existing:
        if existing.workload != workload:
            raise ValueError("deployment id is already bound to another workload")
        return existing
    return store.put(DeploymentRecord(deployment_id=deployment_id, workload=workload))

def checkpoint(record: DeploymentRecord, name: str, event_sink=None) -> DeploymentRecord:
    if not name:
        raise ValueError("checkpoint name is required")
    record.checkpoint = name
    if event_sink is not None:
        event_sink.emit(RuntimeEvent.create(
            record.deployment_id, record.workload, "checkpoint", record.state,
            record.node, name, evidence=False,
        ))
    return record

def resume(store: MemoryDeploymentStore, deployment_id: str) -> DeploymentRecord:
    record = store.get(deployment_id)
    if record is None:
        raise KeyError(deployment_id)
    return record
