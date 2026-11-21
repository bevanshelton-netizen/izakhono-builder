from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


class Adapter(Protocol):
    name: str
    async def health(self) -> dict[str, Any]: ...


@dataclass
class AdapterRegistry:
    adapters: dict[str, Adapter]

    def register(self, adapter: Adapter) -> None:
        if not adapter.name:
            raise ValueError("adapter name required")
        self.adapters[adapter.name] = adapter

    async def health(self) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        for name, adapter in self.adapters.items():
            try:
                result[name] = await adapter.health()
            except Exception as exc:
                result[name] = {"status": "unhealthy", "error": type(exc).__name__}
        return result

    def names(self) -> tuple[str, ...]:
        return tuple(sorted(self.adapters))
