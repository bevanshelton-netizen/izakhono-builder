#!/bin/sh
# NODE01 read-only environment discovery. No activation, writes, network probes, or service changes.
set -u

section() { printf '\n== %s ==\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

section "Execution identity"
printf 'hostname: '; hostname 2>/dev/null || printf 'UNAVAILABLE\n'
printf 'user: '; id -un 2>/dev/null || printf 'UNAVAILABLE\n'
printf 'uid/gid: '; id 2>/dev/null || printf 'UNAVAILABLE\n'
printf 'architecture: '; uname -m 2>/dev/null || printf 'UNAVAILABLE\n'
printf 'kernel: '; uname -sr 2>/dev/null || printf 'UNAVAILABLE\n'

section "Operating system"
if [ -r /etc/os-release ]; then
  sed -n 's/^PRETTY_NAME=//p' /etc/os-release | head -n 1 | tr -d '"'
else
  printf 'os-release: UNAVAILABLE\n'
fi

section "Compute and storage (read-only inventory)"
if have getconf; then printf 'online processors: '; getconf _NPROCESSORS_ONLN 2>/dev/null || printf 'UNAVAILABLE\n'; fi
if [ -r /proc/meminfo ]; then
  awk '/^MemTotal:/ { printf "memory total: %.0f MiB\\n", $2 / 1024 }' /proc/meminfo
else
  printf 'memory total: UNAVAILABLE\n'
fi
if have df; then df -Pk / 2>/dev/null | awk 'NR == 1 || NR == 2 { print }'; else printf 'disk inventory: df unavailable\n'; fi

section "Container tooling (version and daemon read checks only)"
if have docker; then
  printf 'docker client: '
  docker --version 2>/dev/null || printf 'UNAVAILABLE\n'
  printf 'docker daemon: '
  docker info --format 'server={{.ServerVersion}} storage-driver={{.Driver}}' 2>/dev/null || printf 'UNAVAILABLE OR ACCESS DENIED\n'
  printf 'docker compose plugin: '
  docker compose version 2>/dev/null || printf 'UNAVAILABLE\n'
else
  printf 'docker: NOT INSTALLED OR NOT IN PATH\n'
fi
if have docker-compose; then
  printf 'legacy docker-compose: '
  docker-compose version 2>/dev/null || printf 'UNAVAILABLE\n'
else
  printf 'legacy docker-compose: NOT INSTALLED\n'
fi

section "Network tools (presence only; no probes performed)"
for tool in ip ss curl; do
  if have "$tool"; then printf '%s: PRESENT\n' "$tool"; else printf '%s: NOT FOUND\n' "$tool"; fi
done

section "Safety result"
printf '%s\n' 'READ-ONLY INVENTORY COMPLETE. No files were created or changed by this script.'
printf '%s\n' 'No network requests, DNS changes, firewall changes, container starts, builds, or secret generation were performed.'
printf '%s\n' 'This report does not authorise activation or prove production readiness.'
exit 0
