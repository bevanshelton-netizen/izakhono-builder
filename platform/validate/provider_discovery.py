"""Supplier-neutral, strictly read-only provider discovery contracts.

Only local fixture I/O is implemented here. Live providers must implement these
read methods with provider-enforced read-only credentials and explicit timeouts.
No provisioning, mutation, shell, DNS, firewall, or mail-routing methods exist.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Protocol

from jsonschema import Draft202012Validator, FormatChecker

DISCOVERY_SCHEMA = Path(__file__).resolve().parent / "schemas/provider-readonly-discovery.schema.json"


class ReadOnlyProviderAdapter(Protocol):
    """Minimum interface for future supplier adapters; intentionally read-only."""

    provider_id: str
    adapter_version: str

    def discover_capabilities(self) -> dict[str, Any]:
        """Return a normalized, evidence-labelled capability document."""
        ...

    def list_resources(self) -> list[dict[str, Any]]:
        """Return resources visible to the read-only identity; never reserve them."""
        ...


class FixtureProviderAdapter:
    """Offline adapter for deterministic tests and contract development."""

    def __init__(self, fixture_path: Path):
        self.fixture_path = fixture_path
        self._document: dict[str, Any] | None = None

    def _load(self) -> dict[str, Any]:
        if self._document is None:
            with self.fixture_path.open("r", encoding="utf-8") as handle:
                self._document = json.load(handle)
        return self._document

    @property
    def provider_id(self) -> str:
        return self._load()["providerId"]

    @property
    def adapter_version(self) -> str:
        return self._load()["adapterVersion"]

    def discover_capabilities(self) -> dict[str, Any]:
        document = self._load()
        return {
            key: value
            for key, value in document.items()
            if key not in ("resources", "warnings")
        }

    def list_resources(self) -> list[dict[str, Any]]:
        return list(self._load()["resources"])


def validate_discovery(document: dict[str, Any]) -> list[str]:
    with DISCOVERY_SCHEMA.open("r", encoding="utf-8") as handle:
        schema = json.load(handle)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(
        validator.iter_errors(document),
        key=lambda error: list(map(str, error.absolute_path)),
    )
    return [
        f"/{'/'.join(map(str, error.absolute_path)) or '<root>'}: {error.message}"
        for error in errors
    ]


def combine_discovery(
    capabilities: dict[str, Any], resources: list[dict[str, Any]], warnings: list[str] | None = None
) -> dict[str, Any]:
    """Combine read results; force readOnly=true and never infer approval."""
    result = dict(capabilities)
    result["readOnly"] = True
    result["resources"] = resources
    result["warnings"] = list(warnings or [])
    return result
