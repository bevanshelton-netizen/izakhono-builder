"""Provider-neutral reconciliation and rollback contract for Provisioner."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Callable, Mapping

@dataclass(frozen=True)
class RecoveryAction:
    operation_id: str
    action: str
    target_state: str
    reason: str
    safe_to_run: bool

class ReconciliationPlan:
    ORDER = ("PAYMENT_VERIFIED", "TENANT_CREATED", "DOMAIN_READY", "DNS_READY", "SITE_READY", "TLS_READY", "MAIL_READY", "INTEGRATIONS_READY")

    def build(self, current_state: str, evidence: Mapping[str, object], failed_state: str) -> list[RecoveryAction]:
        if failed_state not in self.ORDER:
            return []
        index = self.ORDER.index(failed_state)
        actions: list[RecoveryAction] = []
        for state in reversed(self.ORDER[:index]):
            if state in evidence:
                actions.append(RecoveryAction(f"reconcile_{failed_state}_{state}", "VERIFY_EXISTING", state, f"reconcile after failure at {failed_state}", True))
        return actions

class RecoveryExecutor:
    def __init__(self, handlers: Mapping[str, Callable[[RecoveryAction], bool]]):
        self.handlers = dict(handlers)

    def execute(self, actions: list[RecoveryAction]) -> list[bool]:
        results: list[bool] = []
        for action in actions:
            if not action.safe_to_run:
                results.append(False); continue
            handler = self.handlers.get(action.action)
            results.append(bool(handler and handler(action)))
        return results

if __name__ == "__main__":
    plan = ReconciliationPlan().build("SITE_READY", {"PAYMENT_VERIFIED": {}, "TENANT_CREATED": {}, "DOMAIN_READY": {}}, "DNS_READY")
    assert [a.target_state for a in plan] == ["DOMAIN_READY", "TENANT_CREATED", "PAYMENT_VERIFIED"]
    executor = RecoveryExecutor({"VERIFY_EXISTING": lambda action: True})
    assert executor.execute(plan) == [True, True, True]
    print("RECONCILIATION: PASS")
