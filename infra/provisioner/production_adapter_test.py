"""Deterministic tests for the strict production adapter boundary."""
from production_adapter import AdapterContext, ProductionAdapterError, ProductionBoundary


class Fake:
    name = "fake"
    capability = "site"
    ownership = "owned"
    reversible = True
    def __init__(self, simulation=False, ready=True):
        self.simulation = simulation
        self.ready = ready
    def readiness(self):
        return {"ready": self.ready, "simulation": self.simulation}
    def execute(self, context):
        return {"evidence_id":"ev", "observed_at":"now", "verified":True, "checks":["ok"], "simulation":self.simulation}
    def reconcile(self, context, reason):
        return {"evidence_id":"rev", "verified":True, "simulation":self.simulation}


def ctx():
    return AdapterContext("op", "tenant", "site", "idem", "exec", {})


def smoke():
    good = ProductionBoundary({"site": Fake()})
    assert good.execute(ctx(), "owned")["verified"] is True
    try: ProductionBoundary({"site": Fake(simulation=True)}).execute(ctx(), "owned")
    except ProductionAdapterError: pass
    else: raise AssertionError("simulation accepted")
    try: ProductionBoundary({"site": Fake(ready=False)}).execute(ctx(), "owned")
    except ProductionAdapterError: pass
    else: raise AssertionError("unready adapter accepted")
    try: ProductionBoundary({}).execute(ctx(), "owned")
    except ProductionAdapterError: pass
    else: raise AssertionError("missing production adapter accepted")
    print("PRODUCTION_ADAPTER_TEST: PASS")

if __name__ == "__main__":
    smoke()
