#!/usr/bin/env python3
"""Provider-neutral handoff from Provisioner to IZAKHONO Runtime Fabric.

Provisioning creates/updates workload state. This bridge only hands a completed
workload contract and externally supplied health evidence to Runtime Fabric.
It does not execute infrastructure by itself, create acceptance evidence, store
secrets, or promote a workload to LIVE_VERIFIED.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable, Mapping

_CONTROLLER_DIR = Path(__file__).resolve().parents[1] / "runtime-fabric" / "controller"
if str(_CONTROLLER_DIR) not in sys.path:
    sys.path.insert(0, str(_CONTROLLER_DIR))

from workload_activation import ActivationRequest, activate_workload  # noqa: E402


def handoff(
    contract: Mapping,
    health: Mapping[str, bool],
    activate: Callable[[str], bool],
    acceptance: Callable[[str], bool],
):
    """Hand a workload to Runtime Fabric without changing promotion state."""
    request = ActivationRequest(workload=contract.get("workload", ""), health=health)
    return activate_workload(contract, request, activate, acceptance)


if __name__ == "__main__":
    print("Provisioner → Runtime Fabric bridge: import-only smoke PASS")
