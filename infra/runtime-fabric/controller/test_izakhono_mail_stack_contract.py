#!/usr/bin/env python3
"""Verify the Runtime Fabric workload binds the canonical Stalwart + HOST bridge stack."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def service_block(source: str, service: str) -> str:
    lines = source.splitlines()
    start = next((i for i, line in enumerate(lines) if line == f"  {service}:"), None)
    if start is None:
        raise AssertionError(f"compose service missing: {service}")
    end = next((i for i in range(start + 1, len(lines)) if lines[i] and len(lines[i]) - len(lines[i].lstrip(" ")) == 2), len(lines))
    return "\n".join(lines[start:end])


def main() -> None:
    contract = json.loads((ROOT / "infra/runtime-fabric/workloads/izakhono-mail.json").read_text())
    host_path = ROOT / "products/izakhono-host/docker-compose.owned.yml"
    mail_path = ROOT / "products/izakhono-host/mail/docker-compose.mail.yml"
    bridge_path = ROOT / "products/izakhono-host/runtime/mail-bridge/server.mjs"
    activation_path = ROOT / "products/izakhono-host/mail/STALWART-ACTIVATE.sh"

    host = host_path.read_text()
    mail = mail_path.read_text()
    bridge = bridge_path.read_text()
    activation = activation_path.read_text()

    services = contract["services"]
    assert services["control_plane"] == "products/izakhono-host"
    assert services["mail_transport"] == "products/izakhono-host/mail/docker-compose.mail.yml"
    assert services["mail_transport_service"] == "stalwart"
    assert services["mail_bridge"] == "products/izakhono-host/runtime/mail-bridge"
    assert services["private_network"] == "izakhono-mail"
    assert services["canonical_runtime"] is True
    assert services["parallel_mail_stack_allowed"] is False

    host_bridge = service_block(host, "mail-bridge")
    assert "SMTP_HOST:" in host_bridge
    assert 'SMTP_HOST="${SMTP_HOST:-stalwart}"' in activation
    assert "networks: [izakhono, izakhono-mail]" in host_bridge
    assert "ports:" not in host_bridge
    assert "name: izakhono-mail" in host

    stalwart = service_block(mail, "stalwart")
    assert "image: stalwartlabs/stalwart:" in stalwart
    for port in ("25:25", "465:465", "587:587", "143:143", "993:993", "8443:443"):
        assert port in stalwart, f"Stalwart port mapping missing: {port}"
    assert "stalwart-etc:/etc/stalwart" in stalwart
    assert "stalwart-data:/var/lib/stalwart" in stalwart
    assert "healthcheck:" in stalwart
    assert "external: true" in mail and "name: izakhono-mail" in mail

    assert "smtpHost = process.env.SMTP_HOST || 'stalwart'" in bridge
    assert "IZAKHONO_MAIL_API_TOKEN" in bridge
    assert "transporter.sendMail" in bridge
    assert "STALWART_RECOVERY_ADMIN" in activation
    assert "SMTP_PORT=465" in activation and "SMTP_TLS_MODE=tls" in activation
    assert "docker compose -f docker-compose.mail.yml up -d" in activation

    mail_acceptance = set(contract["acceptance"]["mail"])
    assert {"smtp-submission", "smtp-inbound", "imap-authentication", "spf", "dkim", "dmarc", "ptr", "send-receive-reply"} <= mail_acceptance
    assert contract["deployment"]["current_state"] == "integration-contract-prepared-execution-unverified"
    print("IZAKHONO MAIL STACK CONTRACT: PASS")


if __name__ == "__main__":
    main()
