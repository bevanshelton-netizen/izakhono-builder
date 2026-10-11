from __future__ import annotations

import asyncio
from .engine import Orchestrator
from .integration import ControlPlaneExecutor


def run_integrated(objective: str):
    """Run NODE01 with the local control-plane bridge enabled."""
    return asyncio.run(Orchestrator(executor=ControlPlaneExecutor()).run(objective))
