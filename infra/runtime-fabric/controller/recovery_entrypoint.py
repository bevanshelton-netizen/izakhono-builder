#!/usr/bin/env python3
"""Runtime entrypoint with an explicit provider adapter boundary.

Production wiring must provide IZAKHONO_RECOVERY_FACTORY as module:function.
The entrypoint intentionally fails closed instead of guessing database
credentials, secrets, or infrastructure adapters.
"""
from __future__ import annotations

import importlib
import os

from recovery_supervisor import RecoverySupervisor


def load_factory():
    target = os.getenv("IZAKHONO_RECOVERY_FACTORY", "")
    if not target or ":" not in target:
        raise RuntimeError(
            "IZAKHONO_RECOVERY_FACTORY must be configured as module:function"
        )
    module_name, function_name = target.split(":", 1)
    module = importlib.import_module(module_name)
    factory = getattr(module, function_name, None)
    if not callable(factory):
        raise RuntimeError(f"recovery factory is not callable: {target}")
    return factory


def main() -> int:
    factory = load_factory()
    worker = factory()
    RecoverySupervisor(worker).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
