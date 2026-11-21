# IZAKHONO WATCH™

Dependency-light local watchdog for the sovereign estate.

WATCH probes only approved local health endpoints. It does not restart workloads, deploy software, modify DNS or expose management interfaces.

Default targets:
- NODE /healthz
- CONTROL /healthz
- REGISTRY /healthz

Default bind: 127.0.0.1:9595.
