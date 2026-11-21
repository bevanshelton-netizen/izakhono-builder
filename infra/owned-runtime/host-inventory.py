#!/usr/bin/env python3
"""Read-only inventory of an existing HOST execution environment.

No network requests, provisioning, package installation, service changes, or
credential reads are performed. Review the JSON locally before sharing it.
"""
from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
from pathlib import Path


def command(args: list[str]) -> str | None:
    try:
        result = subprocess.run(args, check=False, capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return result.stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        pass
    return None


def memory_total_bytes() -> int | None:
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemTotal:"):
                return int(line.split()[1]) * 1024
    except (OSError, ValueError, IndexError):
        pass
    return None


def main() -> None:
    os_release = {}
    try:
        for line in Path("/etc/os-release").read_text().splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                os_release[key] = value.strip().strip('"')
    except OSError:
        pass

    root = shutil.disk_usage("/")
    virt = command(["systemd-detect-virt"]) or "unknown"
    docker_version = command(["docker", "--version"]) if shutil.which("docker") else None
    docker_info = command(["docker", "info", "--format", "{{.ServerVersion}};{{.OperatingSystem}};{{.Architecture}}"]) if docker_version else None
    default_route = command(["sh", "-c", "ip route show default 2>/dev/null | head -n 1"])
    listening = command(["sh", "-c", "ss -H -lntu 2>/dev/null | awk '{print $1, $5}' | sed -E 's/.*:([0-9]+)$/\\1/' | sort -u | tr '\\n' ' '"])

    report = {
        "schema": "izakhono.host-inventory.v1",
        "classification": "READ_ONLY_LOCAL_INVENTORY",
        "status": "INVENTORY_ONLY_NO_CHANGES",
        "collected_at_utc": command(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"]),
        "host": {
            "hostname": platform.node(),
            "os": os_release.get("PRETTY_NAME", platform.platform()),
            "os_id": os_release.get("ID"),
            "os_version": os_release.get("VERSION_ID"),
            "kernel": platform.release(),
            "architecture": platform.machine(),
            "virtualization": virt,
        },
        "capacity": {
            "cpu_logical_count": os.cpu_count(),
            "memory_total_bytes": memory_total_bytes(),
            "root_filesystem_total_bytes": root.total,
            "root_filesystem_free_bytes": root.free,
        },
        "runtime": {
            "systemd": shutil.which("systemctl") is not None,
            "docker_cli": docker_version,
            "docker_server": docker_info,
        },
        "network_metadata": {
            "default_route_present": bool(default_route),
            "listening_protocol_port_summary": listening or None,
            "ip_addresses_collected": False,
            "external_public_reachability_tested": False,
        },
        "safety": {
            "credentials_read": False,
            "outbound_network_requests": False,
            "services_changed": False,
            "packages_installed": False,
            "infrastructure_provisioned": False,
            "production_deployment_performed": False,
            "security_assessment_completed": False,
        },
        "limitations": [
            "This report describes only the machine on which it is run.",
            "It does not prove ownership, authorization, public reachability, security compliance, or production readiness.",
            "Docker server details may be unavailable to an unprivileged user.",
            "Review and redact hostname and port metadata before sharing outside the operations team.",
        ],
    }
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
