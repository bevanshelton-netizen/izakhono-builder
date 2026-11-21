#!/usr/bin/env bash
set -Eeuo pipefail

# Read-only inventory for an already-owned IZAKHONO execution host.
# Does not install packages, alter networking, start services, or print secrets.
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required for inventory output." >&2; exit 2; }

python3 - <<'PY'
import json, os, platform, re, shutil, subprocess
from datetime import datetime, timezone
from pathlib import Path

def run(args):
    try:
        p = subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=8, check=False)
        return p.stdout.strip() if p.returncode == 0 else None
    except Exception:
        return None

def service(name):
    value = run(["systemctl", "is-active", name])
    return value or "unknown"

def version(args):
    return run(args)

os_release = {}
try:
    for line in Path("/etc/os-release").read_text().splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            os_release[k] = v.strip().strip('"')
except Exception:
    pass

mem_kb = None
try:
    for line in Path("/proc/meminfo").read_text().splitlines():
        if line.startswith("MemTotal:"):
            mem_kb = int(line.split()[1])
            break
except Exception:
    pass

cpu_model = None
try:
    for line in Path("/proc/cpuinfo").read_text().splitlines():
        if line.lower().startswith(("model name", "hardware")) and ":" in line:
            cpu_model = line.split(":", 1)[1].strip()
            break
except Exception:
    pass

disk = {}
for mount in ("/", "/opt", "/var/lib"):
    out = run(["df", "-Pk", mount])
    if out:
        rows = out.splitlines()
        if len(rows) > 1:
            cols = rows[-1].split()
            if len(cols) >= 6:
                disk[mount] = {"total_kb": int(cols[1]), "used_kb": int(cols[2]), "free_kb": int(cols[3]), "mount": cols[5]}

addresses = []
out = run(["ip", "-o", "addr", "show", "scope", "global"])
if out:
    for line in out.splitlines():
        match = re.search(r"\\binet6?\\s+([^/\\s]+)", line)
        if match:
            addresses.append(match.group(1))

listeners = []
out = run(["ss", "-H", "-lntu"])
if out:
    for line in out.splitlines():
        cols = line.split()
        if len(cols) >= 5:
            listeners.append({"protocol": cols[0], "local": cols[4]})

docker = None
if shutil.which("docker"):
    docker = {
        "client_version": version(["docker", "--version"]),
        "server": version(["docker", "info", "--format", "{{.ServerVersion}}"]),
        "compose": version(["docker", "compose", "version", "--short"]),
        "daemon_service": service("docker"),
    }

record = {
    "schema": "izakhono.owned-host-inventory/v1",
    "checked_at": datetime.now(timezone.utc).isoformat(),
    "hostname": platform.node(),
    "os": {"name": os_release.get("PRETTY_NAME"), "id": os_release.get("ID"), "version": os_release.get("VERSION_ID")},
    "architecture": platform.machine(),
    "virtualization": run(["systemd-detect-virt"]) or "unknown",
    "cpu": {"logical_cores": os.cpu_count(), "model": cpu_model},
    "memory_total_kb": mem_kb,
    "disk": disk,
    "network": {"global_addresses": sorted(set(addresses)), "default_route": run(["ip", "-4", "route", "show", "default"])},
    "services": {"docker": service("docker"), "k3s": service("k3s"), "ssh": service("ssh")},
    "docker": docker,
    "available_commands": {name: bool(shutil.which(name)) for name in ("docker", "python3", "node", "git", "ip", "ss", "curl", "k3s", "restic")},
    "listening_sockets": listeners,
    "safety": {"read_only": True, "secrets_collected": False, "network_changed": False, "services_changed": False}
}
print(json.dumps(record, indent=2, sort_keys=True))
PY
