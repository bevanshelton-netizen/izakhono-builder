# IZAKHONO SUPER CLOUD

IZAKHONO's owned-first cloud control plane and infrastructure platform.

## Mission

Build an African-first, globally deployable cloud that can host the IZAKHONO portfolio and customer workloads without making the business dependent on a single hyperscaler.

## Core principle

**Owned-first. Externally reversible.**

External providers may be used for bootstrap capacity, regional edge, registry services or disaster recovery, but application/data architecture remains portable and controlled by IZAKHONO.

## Platform layers

1. **Control Plane** — tenants, projects, environments, users, billing, quotas, deployments and audit.
2. **Compute Plane** — containers, VMs/bare metal adapters, jobs, workers and autoscaling.
3. **Network Plane** — private networks, ingress, service discovery, DNS, TLS, firewall and load balancing.
4. **Data Plane** — PostgreSQL, Redis/Valkey, object storage, block/file storage and backups.
5. **Developer Plane** — Git integration, build runners, registries, deployment pipelines, secrets and environment variables.
6. **AI Plane** — model gateway, inference workers, embeddings/vector storage, agent runtimes and GPU scheduling adapters.
7. **Media Plane** — video storage, transcoding, live streaming, CDN/edge adapters and content delivery for KORA.
8. **Mail Plane** — IZAKHONO MAIL domains, SMTP, IMAP, webmail, SPF/DKIM/DMARC and abuse controls.
9. **Security Plane** — FORTRESS identity, RBAC, secrets, audit, threat detection, isolation and incident controls.
10. **Observability Plane** — metrics, logs, traces, health checks, alerts and capacity intelligence.

## Initial workload classes

- Websites and APIs
- SaaS applications
- Business email
- Databases
- Object/file storage
- Background jobs
- CI/CD builds
- AI agents and inference
- KORA NETWORK media workloads
- Marketplace and commerce workloads
- Customer hosting tenants

## Architecture

```text
                    IZAKHONO SUPER CLOUD
                            |
             +--------------+--------------+
             |                             |
       CONTROL PLANE                 FORTRESS
             |                             |
      +------+------+---------------+------+------+
      |      |      |               |             |
   Compute  Data  Network          AI           Media
      |      |      |               |             |
      +------+------+---------------+-------------+
                            |
                     Workload Fabric
                            |
       +----------+---------+---------+----------+
       |          |                   |          |
     KORA     IZAKHONO MAIL       Websites    Customer
    NETWORK                       / APIs      tenants
```

## Non-negotiable production gates

A component is not called **LIVE** merely because its source code exists. Production status requires deployment, reachable endpoint, DNS/TLS where applicable, health checks, backup/restore evidence, security controls and a verified rollback path.

## Rollout strategy

### Phase 1 — Cloud Core

- Control-plane API
- tenant/project model
- workload registry
- environment model
- health/heartbeat model
- audit events
- deployment records
- provider/region inventory

### Phase 2 — Infrastructure Fabric

- container runtime adapter
- PostgreSQL service
- object storage
- cache/queue
- ingress/TLS
- authoritative DNS adapter
- private network model
- backup/restore

### Phase 3 — Developer Cloud

- Git deployment
- build pipeline
- image registry
- secrets
- environment variables
- preview environments
- production promotion/rollback

### Phase 4 — Commercial Cloud

- customer onboarding
- plans/quotas
- usage metering
- invoices
- payment verification
- automatic provisioning
- suspension/reactivation

### Phase 5 — AI + Media

- AI Gateway
- model routing
- GPU worker abstraction
- vector storage
- media processing
- streaming/origin services
- KORA delivery

### Phase 6 — Multi-region

- regional control-plane replicas
- workload placement
- failover
- replicated object storage
- database replication
- traffic steering
- disaster recovery

## Current state

The repository already contains IZAKHONO HOST runtime components for authoritative DNS, contact gateway, control plane, mail bridge and provisioning. The Super Cloud layer formalizes these into one cloud operating model instead of isolated projects.

**Status:** ARCHITECTURE + CONTROL-PLANE FOUNDATION IN BUILD.

No external provider is represented as an IZAKHONO-owned data centre or physical cloud. Physical compute, network transit and power remain deployment dependencies until owned capacity is actually commissioned and verified.
