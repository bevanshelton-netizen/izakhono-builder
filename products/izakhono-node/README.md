# IZAKHONO NODE™ v1

**Owner-controlled compute and deployment runtime for the IZAKHONO ecosystem.**

IZAKHONO NODE is not a GitHub runner and it is not a wrapper around Vercel, Railway or another hosting vendor. It is the software that turns hardware controlled by IZAKHONO into an authenticated deployment and service-execution node.

## Core architecture

```text
IZAKHONO CODE
     │
     │ owner-controlled Git source
     ▼
IZAKHONO CONTROL
     │
     │ HMAC-signed deployment job
     ▼
IZAKHONO NODE
     │
     ├── immutable source checkout
     ├── Docker build
     ├── canary health gate
     ├── promote / rollback
     ├── Compose service stacks
     ├── deployment evidence
     └── future cluster scheduling
```

### NODE 01

NODE 01 is the preferred primary owner node.

It can initially run on the dedicated Windows laptop through the IZAKHONO owner-host Ubuntu/WSL environment. It does **not** require a GitHub self-hosted Actions registration token.

Default local services:

- IZAKHONO NODE: `http://127.0.0.1:9191`
- IZAKHONO CONTROL: `http://127.0.0.1:9292`
- IZAKHONO CODE repositories: `/srv/izakhono-code/repos/*.git`

The services bind to loopback by default. Public application traffic must go through the reviewed IZAKHONO EDGE/TLS path; NODE management ports are not public application endpoints.

## Sovereignty rules

1. **IZAKHONO CODE is the preferred source.**
   Jobs using `source=izakhono-code` resolve to owner-controlled bare Git repositories under `/srv/izakhono-code/repos`.

2. **GitHub is a temporary mirror only.**
   `source=github-mirror` remains available during migration and is restricted to the owner-controlled `bevanshelton-netizen` namespace. It can later be disabled with `IZAKHONO_ALLOW_GITHUB_MIRROR=false`.

3. **Production means immutable.**
   Production deployment jobs must request a full 40-character commit SHA. Branch names such as `main` are rejected for production promotion.

4. **The node accepts signed commands only.**
   IZAKHONO CONTROL signs each request with HMAC-SHA256, timestamp and one-time nonce. The node rejects stale, replayed or incorrectly signed jobs.

5. **Jobs are idempotent.**
   CONTROL derives an idempotency key from app/environment/ref/source unless one is explicitly supplied. Replayed deployment requests return the original job instead of creating duplicate production work.

6. **Health before promotion.**
   Single-service deployments build and start a local canary first. Compose services must pass a localhost health endpoint before they are accepted.

7. **Rollback is automatic.**
   Failed production health/public acceptance restores the previous image/revision where one exists.

8. **Evidence is local and signed.**
   Completed jobs write owner-node evidence under `/var/lib/izakhono-node/evidence` with job/output digests and an HMAC proof. The secret itself is never written into proof files.

## Supported workload modes

### Single service

For applications with one Dockerfile and one application port.

Example CONTROL request:

```json
{
  "source": "izakhono-code",
  "repository": "allegro-vibez",
  "app": "allegro-vibez",
  "ref": "0123456789012345678901234567890123456789",
  "environment": "production",
  "mode": "single",
  "container_port": 8080,
  "health_path": "/healthz",
  "public_url": "https://allegro.example.com"
}
```

### Compose service

For multi-process services such as ALLEGRO Radio.

```json
{
  "source": "izakhono-code",
  "repository": "allegro-vibez",
  "app": "allegro-radio",
  "ref": "0123456789012345678901234567890123456789",
  "environment": "production",
  "mode": "compose",
  "compose_file": "radio/owner-node/docker-compose.yml",
  "health_url": "http://127.0.0.1:8000/status-json.xsl",
  "env_file": "/etc/izakhono/apps/allegro-radio.env"
}
```

Environment files are restricted to `/etc/izakhono/apps/`.

## One-click NODE 01 activation

Prerequisite: the IZAKHONO Windows owner host must already be installed and Docker must be healthy.

From this product folder, double-click:

`START-IZAKHONO-NODE.cmd`

The launcher invokes the Ubuntu owner host, installs NODE + CONTROL, creates machine-local secrets, enables the system services, verifies NODE readiness and CONTROL health, and writes activation evidence.

It does **not** request a GitHub runner token.

## Local owner credentials

Installer-generated credentials remain on the owner host:

- `/etc/izakhono/node.env`
- `/etc/izakhono/control.env`
- `/etc/izakhono/control.owner-token`

Permissions are restricted to the local owner/root environment. Do not commit these files.

## Cluster path

The existing `infra/node-cluster/` software extends this runtime to four owner-controlled machines:

- NODE 01 — preferred primary
- NODE 02 — backup/control-plane
- NODE 03 — backup/control-plane
- NODE 04 — DR/workload node

The cluster layer uses k3s, encrypted secrets, WireGuard-native networking, replicated IZAKHONO DATA and tested backup/restore procedures. A cluster is only called production-ready after real hardware, failover, restore and external-edge tests pass.

## What this replaces

IZAKHONO NODE is the long-term replacement for using a third-party CI runner as the production execution mechanism.

Third-party source mirrors may still be used while repositories are being migrated, but the target flow is:

**IZAKHONO CODE → IZAKHONO CONTROL → IZAKHONO NODE → IZAKHONO EDGE**

## Readiness boundary

CI can prove the software rules, syntax and security invariants. It cannot prove the actual Windows laptop, WSL environment, Docker daemon, disks, network, public TLS route or power resilience until NODE 01 is activated on the physical machine and the evidence checks pass.
