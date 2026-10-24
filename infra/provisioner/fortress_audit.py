"""FORTRESS audit boundary for Provisioner operations.

Append-only, secret-free audit records. This module does not claim that an
external FORTRESS service is live; it defines the durable contract the runtime
must use when the FORTRESS adapter is attached.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping, Protocol

SECRET_FIELDS = {"password", "token", "api_key", "access_token", "refresh_token", "private_key", "client_secret", "secret"}

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def reject_secrets(value: Any, path: str = "payload") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in SECRET_FIELDS:
                raise ValueError(f"secret field prohibited at {path}.{key}")
            reject_secrets(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_secrets(child, f"{path}[{index}]")

@dataclass(frozen=True)
class AuditRecord:
    event_id: str
    job_id: str
    tenant_id: str
    event_type: str
    state: str
    operation_id: str
    actor: str
    observed_at: str
    metadata: Mapping[str, Any]

class AuditSink(Protocol):
    def append(self, record: AuditRecord) -> None: ...

class MemoryAuditSink:
    def __init__(self) -> None:
        self.records: list[AuditRecord] = []
        self._ids: set[str] = set()

    def append(self, record: AuditRecord) -> None:
        reject_secrets(record.metadata)
        if record.event_id in self._ids:
            return
        self._ids.add(record.event_id)
        self.records.append(record)

def build_audit(job_id: str, tenant_id: str, event_type: str, state: str, operation_id: str, actor: str = "provisioner-worker", metadata: Mapping[str, Any] | None = None) -> AuditRecord:
    data = dict(metadata or {})
    reject_secrets(data)
    return AuditRecord(f"audit_{job_id}_{operation_id}_{event_type}", job_id, tenant_id, event_type, state, operation_id, actor, utc_now(), data)

if __name__ == "__main__":
    sink = MemoryAuditSink()
    record = build_audit("job-1", "tenant-1", "ADAPTER_VERIFIED", "DOMAIN_READY", "op-1", metadata={"adapter": "izakhono-domain", "verified": True})
    sink.append(record); sink.append(record)
    assert len(sink.records) == 1
    try:
        build_audit("job-1", "tenant-1", "BAD", "DOMAIN_READY", "op-2", metadata={"token": "never"})
        raise AssertionError("secret audit metadata was accepted")
    except ValueError:
        pass
    print("FORTRESS_AUDIT: PASS")
