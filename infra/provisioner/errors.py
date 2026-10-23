"""Shared Provisioner error types."""
from __future__ import annotations

class ProvisionerError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

class ServiceError(ProvisionerError):
    pass
