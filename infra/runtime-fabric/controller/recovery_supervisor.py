#!/usr/bin/env python3
"""Provider-neutral supervisor for the IZAKHONO Runtime Fabric recovery worker.

The supervisor owns process lifecycle only. Deployment decisions remain in the
reconciler and durable deployment state remains in the configured store.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Callable, Optional

from recovery_worker import RecoveryWorker


@dataclass(frozen=True)
class SupervisorConfig:
    interval_seconds: int = 30
    max_cycles: Optional[int] = None

    @classmethod
    def from_env(cls) -> "SupervisorConfig":
        interval = int(os.getenv("IZAKHONO_RECOVERY_INTERVAL_SECONDS", "30"))
        max_cycles_raw = os.getenv("IZAKHONO_RECOVERY_MAX_CYCLES", "")
        max_cycles = int(max_cycles_raw) if max_cycles_raw else None
        if interval < 1:
            raise ValueError("IZAKHONO_RECOVERY_INTERVAL_SECONDS must be >= 1")
        if max_cycles is not None and max_cycles < 1:
            raise ValueError("IZAKHONO_RECOVERY_MAX_CYCLES must be >= 1")
        return cls(interval, max_cycles)


class RecoverySupervisor:
    """Run the recovery worker repeatedly without owning deployment policy."""

    def __init__(self, worker: RecoveryWorker, config: SupervisorConfig | None = None,
                 sleeper: Callable[[float], None] = time.sleep):
        self.worker = worker
        self.config = config or SupervisorConfig.from_env()
        self.sleeper = sleeper

    def run(self) -> int:
        cycles = 0
        while True:
            self.worker.run_once()
            cycles += 1
            if self.config.max_cycles is not None and cycles >= self.config.max_cycles:
                return cycles
            self.sleeper(self.config.interval_seconds)


__all__ = ["RecoverySupervisor", "SupervisorConfig"]
