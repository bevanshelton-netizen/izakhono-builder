from domain_production_adapter import DomainConfig, IzakhonoDomainProductionAdapter
from production_adapter_contract import ProductionRequest


class FakeDomain(IzakhonoDomainProductionAdapter):
    def __init__(self, result):
        super().__init__(DomainConfig("https://domain.invalid", "vault://domain/test"))
        self.result = result

    def _transport(self, endpoint, payload, timeout):
        assert payload["domain"] == "example.co.za"
        return self.result


def request():
    return ProductionRequest("op-domain-test", "tenant-domain", "domain", "idem-domain-test",
                             {"domain": "Example.CO.ZA"}, "exec-domain-test")


def main():
    evidence = FakeDomain({"verified": True, "evidence_id": "dom-1", "observed_at": "now",
                           "checks": ["domain.control.accepted"], "live": False, "simulation": False}).execute(request())
    assert evidence.verified and evidence.ownership == "owned" and not evidence.simulation

    try:
        FakeDomain({"verified": False}).execute(request())
    except RuntimeError as exc:
        assert str(exc) == "DOMAIN_VERIFICATION_NOT_CONFIRMED"
    else:
        raise AssertionError("unverified domain result was accepted")

    try:
        FakeDomain({"verified": True, "evidence_id": "dom-sim", "observed_at": "now",
                    "checks": ["fake"], "simulation": True}).execute(request())
    except ValueError as exc:
        assert str(exc) == "SIMULATION_EVIDENCE_NOT_ACCEPTABLE_FOR_PRODUCTION"
    else:
        raise AssertionError("simulation evidence was accepted")

    print("IZAKHONO_DOMAIN_PRODUCTION_ADAPTER_TEST: PASS")


if __name__ == "__main__":
    main()
