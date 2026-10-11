# IZAKHONO NODE01 — Owned Infrastructure Build

NODE01 is the primary IZAKHONO-owned compute node. External deployment providers are optional fallbacks, not the production foundation.

## Software stack

1. Linux host/VM
2. Docker Engine + Compose
3. NODE01 control runtime on `8090`
4. Private OCI registry on `127.0.0.1:5000`
5. Private `izakhono` Docker network
6. Workload runtime, beginning with SUPER SEO on `8097`
7. Health-gated promotion and rollback
8. Monitoring/heartbeat contracts
9. Daily backup service with 30-day retention
10. Restore verification before workload promotion

## Backup scope

- NODE01 configuration
- workload/container inventory
- image inventory
- private registry metadata
- private registry persistent volume
- versioned policy/specification files
- SHA-256 integrity manifest

## Recovery rule

Restore configuration and registry state first. Verify NODE01 control and registry health. Restore/promote workloads individually. A restore is not considered successful until health checks pass.

## First install

Set `NODE01_ADMIN_TOKEN` on the host and run `node01-install.sh` as root. The installer builds the owned runtime, starts the private registry, installs a daily systemd backup timer, and creates the first backup.

## Production rule

No service is declared deployed merely because GitHub built an image. Production readiness requires the NODE01 host to run the workload and pass its health gate.
