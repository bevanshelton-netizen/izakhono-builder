# IZAKHONO BUILDER

Visual, free-first application factory and owned-first infrastructure control plane for IZAKHONO projects.

## Architecture

**CODE → BUILDER → VISUAL ENGINE → PROVISIONER → IZAKHONO CLOUD/NODES → DNS/EDGE/TLS → FORTRESS → runtime**

IZAKHONO owns the source-of-truth state, validated source snapshots, provisioning workflow and preferred production runtime. External providers are replaceable capacity adapters, not foundations.

## Core capabilities

- register applications and reusable product modules
- generate build recipes and release candidates
- deterministic validation and internal source snapshots
- one-sentence Build Anything workflow
- PWA and multi-channel release manifests
- typed provisioning: customer → domain → DNS → site → SSL → mail → billing → acceptance
- owned-first hosting through **IZAKHONO HOST**
- reusable **IZAKHONO Visual Engine** for liquid-glass, 3D, shader-gradient and liquid-brand experiences
- customer/domain/site/invoice/job/audit control plane
- native containerized runtime with Caddy, CoreDNS, PostgreSQL, MinIO and Valkey baseline
- FORTRESS security and owner-gated operations

## IZAKHONO Visual Engine

The Visual Engine is a first-class reusable presentation capability rather than a one-off website effect. It provides replaceable adapters for React Three Fiber, shader-gradient rendering, liquid-glass surfaces and liquid-logo motion, with progressive fallbacks for constrained devices and reduced-motion users.

The first standard profile is `cinematic-glass`. See `design-system/IZAKHONO-VISUAL-ENGINE.md` and `design-system/izakhono-visual-engine.json`.

## IZAKHONO HOST

The current HOST implementation lives at `products/izakhono-host`.

The production target is the **native IZAKHONO runtime**. No external web-hosting platform is required for the core system.

Owned runtime baseline:

- `runtime/control-plane` — native site provisioning control plane
- `runtime/authoritative-dns` — CoreDNS authoritative-DNS baseline
- `edge/Caddyfile` — owned edge/TLS routing baseline
- `docker-compose.owned.yml` — native runtime, edge, DNS, PostgreSQL, MinIO and Valkey

See `products/izakhono-host/OWNED-RUNTIME-V1.md`.

## Internal repositories

Validated generated applications are canonicalized, content-hashed and stored in IZAKHONO's internal repository layer. GitHub is an optional mirror/export target rather than the source of truth.

## Safety and readiness

- no production secrets committed to source control
- no arbitrary owner-mode shell execution
- private-by-default internal source history
- provider credentials remain server-side
- public-live status is evidence-gated
- CI is not treated as proof of public hosting, DNS/TLS, disaster recovery, physical-device testing, security review or customer acceptance

## Deployment principle

**OWNED-FIRST. EXTERNALLY REVERSIBLE. NO HOSTAGE PLATFORM.**

Production activation still requires a Docker-capable IZAKHONO node, public network reachability, DNS delegation, TLS validation, backups/restore testing and end-to-end acceptance evidence.
