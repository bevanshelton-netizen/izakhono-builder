"""Tests for the owned IZAKHONO DOMAIN production boundary."""
from __future__ import annotations
from pathlib import Path
from tempfile import TemporaryDirectory

from izakhono_domain_adapter import IzakhonoDomainAdapter
from production_adapter_contract import ProductionRequest

ZONE = """$ORIGIN izakhono.\n@ IN SOA ns1.izakhono. hostmaster.izakhono. 1 3600 600 86400 60\n@ IN NS ns1.izakhono.\nns1 IN A 10.0.0.2\nmail IN A 10.0.0.3\nwebmail IN A 10.0.0.3\nsmtp IN A 10.0.0.3\nimap IN A 10.0.0.3\nidentity IN A 10.0.0.4\ncloud IN A 10.0.0.5\npay IN A 10.0.0.6\nnav IN A 10.0.0.7\nvoice IN A 10.0.0.8\n"""
COREFILE = "izakhono:53 {\n    file /etc/coredns/izakhono.db\n}\n"


def request(namespace="izakhono"):
    return ProductionRequest("op-domain-1", "tenant-1", "domain", "idem-domain-1", {"namespace": namespace}, "exec-domain-1")


def main():
    with TemporaryDirectory() as tmp:
        root = Path(tmp) / "products" / "izakhono-domain" / "coredns"
        root.mkdir(parents=True)
        (root / "izakhono.db").write_text(ZONE, encoding="utf-8")
        (root / "Corefile").write_text(COREFILE, encoding="utf-8")
        evidence = IzakhonoDomainAdapter(str(root.parent.parent)).execute(request())
        assert evidence.verified and evidence.ownership == "owned"
        assert evidence.reversible and not evidence.simulation

        try:
            IzakhonoDomainAdapter(str(root.parent.parent)).execute(request("public.example"))
        except RuntimeError as exc:
            assert str(exc) == "DOMAIN_NAMESPACE_NOT_SUPPORTED"
        else:
            raise AssertionError("unsupported namespace was accepted")

    print("IZAKHONO_DOMAIN_ADAPTER_TEST: PASS")


if __name__ == "__main__":
    main()
