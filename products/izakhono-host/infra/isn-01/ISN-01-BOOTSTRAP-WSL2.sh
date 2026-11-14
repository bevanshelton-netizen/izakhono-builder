#!/usr/bin/env bash
set -Eeuo pipefail

echo
echo "IZAKHONO ISN-01 — WSL2 / UBUNTU DOCKER ENGINE BOOTSTRAP"
echo "NODE01 remains the logical software identity; ISN-01 is the physical execution environment."
echo

if [[ ! -f /etc/os-release ]]; then
  echo "This script must run inside Ubuntu." >&2
  exit 1
fi
. /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  echo "Ubuntu is required; detected: ${PRETTY_NAME:-unknown}" >&2
  exit 2
fi

if ! grep -qi microsoft /proc/sys/kernel/osrelease && [[ -z "${WSL_DISTRO_NAME:-}" ]]; then
  echo "NOTICE: This does not appear to be WSL2. Continuing with the Linux Docker Engine setup."
fi

if [[ "$(ps -p 1 -o comm= | tr -d ' ')" != "systemd" ]]; then
  echo "systemd is not active as PID 1. Enabling it for WSL2 before installing Docker."
  sudo python3 - <<'PY'
from pathlib import Path
p = Path("/etc/wsl.conf")
text = p.read_text() if p.exists() else ""
lines = text.splitlines()
out = []
in_boot = False
boot_seen = False
systemd_written = False
for line in lines:
    if line.strip().startswith("[") and line.strip().endswith("]"):
        if in_boot and not systemd_written:
            out.append("systemd=true")
            systemd_written = True
        in_boot = line.strip().lower() == "[boot]"
        boot_seen = boot_seen or in_boot
        out.append(line)
        continue
    if in_boot and line.strip().lower().startswith("systemd="):
        out.append("systemd=true")
        systemd_written = True
    else:
        out.append(line)
if in_boot and not systemd_written:
    out.append("systemd=true")
if not boot_seen:
    out.extend(["", "[boot]", "systemd=true"])
p.write_text("\n".join(out).rstrip() + "\n")
PY
  echo
  echo "Restart WSL from Windows PowerShell, then rerun this script:"
  echo "  wsl --shutdown"
  echo "Then reopen Ubuntu."
  exit 10
fi

echo "[1/5] Install base administration and verification tools"
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg jq git openssl dnsutils restic

echo "[2/5] Configure the official Docker Engine repository"
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
ARCH="$(dpkg --print-architecture)"
CODENAME="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $CODENAME stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

echo "[3/5] Install Docker Engine and Compose plugin"
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "[4/5] Configure Docker service and safe log rotation"
sudo groupadd docker 2>/dev/null || true
sudo usermod -aG docker "$USER"
sudo install -m 0755 -d /etc/docker
if [[ ! -f /etc/docker/daemon.json ]]; then
  sudo tee /etc/docker/daemon.json >/dev/null <<'JSON'
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "20m",
    "max-file": "3"
  }
}
JSON
fi
sudo systemctl enable --now docker

echo "[5/5] Verify Docker Engine"
sudo docker info >/dev/null
sudo docker compose version
sudo docker run --rm hello-world

echo
echo "ISN-01 DOCKER BOOTSTRAP: PASSED"
echo "Close and reopen the Ubuntu terminal so docker-group membership takes effect."
echo "Next run from products/izakhono-host:"
echo "  ./NODE-PREFLIGHT.sh"
echo "  ./NODE01-ACTIVATE.sh"
echo
echo "IMPORTANT: WSL2 NAT is not automatically a production public mail/DNS edge."
echo "Static public IP, Windows/router forwarding, firewall rules, reverse DNS/PTR and external port-25 tests remain separate acceptance gates."
