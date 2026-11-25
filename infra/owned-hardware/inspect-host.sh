#!/usr/bin/env bash
# IZAKHONO owned-hardware discovery. Read-only; no configuration changes.
set -u

section() { printf '\n===== %s =====\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

section "IDENTITY"
printf 'Timestamp (UTC): '; date -u '+%Y-%m-%dT%H:%M:%SZ'
printf 'Hostname: '; hostname 2>/dev/null || true
printf 'OS: '
if [[ -r /etc/os-release ]]; then . /etc/os-release; printf '%s %s\n' "${PRETTY_NAME:-unknown}" "${VERSION_ID:-}"; else uname -srm; fi
printf 'Kernel: '; uname -r

section "CPU"
if have lscpu; then lscpu 2>/dev/null | grep -E '^(Architecture|CPU\(s\)|On-line CPU|Thread|Core|Socket|Model name|Virtualization):' || true
elif [[ -r /proc/cpuinfo ]]; then grep -m1 -E '^(model name|Hardware)' /proc/cpuinfo || true; printf 'Logical CPUs: '; getconf _NPROCESSORS_ONLN 2>/dev/null || true
fi

section "MEMORY"
if have free; then free -h; else grep -E '^(MemTotal|MemAvailable|SwapTotal|SwapFree):' /proc/meminfo 2>/dev/null || true; fi

section "BLOCK DEVICES"
if have lsblk; then lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS,MODEL 2>/dev/null || lsblk; else echo "lsblk unavailable"; fi

section "FILESYSTEM CAPACITY"
if have df; then df -hT -x tmpfs -x devtmpfs 2>/dev/null || df -h; fi

section "NETWORK INTERFACES AND ROUTES"
if have ip; then
  ip -brief address 2>/dev/null || true
  echo "-- routes --"
  ip route 2>/dev/null || true
else
  echo "ip command unavailable"
fi

section "LISTENING SOCKETS"
if have ss; then ss -lntup 2>/dev/null || ss -lntu 2>/dev/null || true
else echo "ss command unavailable"; fi

section "FIREWALL SUMMARY"
if have ufw; then ufw status 2>/dev/null || true
elif have firewall-cmd; then firewall-cmd --state 2>/dev/null || true; firewall-cmd --get-active-zones 2>/dev/null || true
elif have nft; then nft list ruleset 2>/dev/null | sed -n '1,100p' || true
elif have iptables; then iptables -S 2>/dev/null | sed -n '1,100p' || true
else echo "No supported firewall inspection command found"; fi

section "CONTAINER RUNTIME"
if have docker; then
  docker --version 2>/dev/null || true
  docker compose version 2>/dev/null || true
  echo "-- daemon summary --"
  docker info --format 'ServerVersion={{.ServerVersion}} OSType={{.OSType}} Architecture={{.Architecture}} CPUs={{.NCPU}} MemoryBytes={{.MemTotal}} DockerRootDir={{.DockerRootDir}}' 2>/dev/null || echo "Docker daemon unavailable or permission denied"
  echo "-- running containers (names and images only) --"
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
  echo "-- named volumes (names only) --"
  docker volume ls --format '{{.Name}}' 2>/dev/null || true
else
  echo "Docker not installed"
fi

section "FAILED SYSTEMD UNITS"
if have systemctl; then systemctl --failed --no-legend --no-pager 2>/dev/null || true; else echo "systemd not detected"; fi

section "INSPECTION LIMITATIONS"
cat <<'NOTE'
This report is a read-only first-pass inventory, not a security audit or production approval.
It does not test public reachability, ISP SMTP policy, CGNAT, PTR control, power resilience,
disk SMART health, backup restorability, or physical ownership. Validate those separately.
Review this output before sharing it; it may contain internal IP addresses, hostnames,
mount paths, firewall rules, and service names. It deliberately does not read environment
files, credentials, private keys, application databases, or container secrets.
No packages, services, firewall rules, filesystems, containers, or DNS records were changed.
NOTE
