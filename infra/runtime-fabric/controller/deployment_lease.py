#!/usr/bin/env python3
"""Provider-neutral deployment lease primitives for distributed recovery."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional


@dataclass(frozen=True)
class Lease:
    deployment_id: str
    owner_id: str
    expires_at: datetime


class MemoryLeaseStore:
    """Deterministic lease store used by tests and local orchestration."""
    def __init__(self) -> None:
        self._leases: Dict[str, Lease] = {}

    def acquire(self, deployment_id: str, owner_id: str, ttl_seconds: int = 60,
                now: Optional[datetime] = None) -> bool:
        now = now or datetime.now(timezone.utc)
        current = self._leases.get(deployment_id)
        if current and current.expires_at > now and current.owner_id != owner_id:
            return False
        self._leases[deployment_id] = Lease(
            deployment_id, owner_id, now + timedelta(seconds=ttl_seconds)
        )
        return True

    def release(self, deployment_id: str, owner_id: str) -> bool:
        current = self._leases.get(deployment_id)
        if not current or current.owner_id != owner_id:
            return False
        del self._leases[deployment_id]
        return True

    def get(self, deployment_id: str) -> Optional[Lease]:
        return self._leases.get(deployment_id)
