# IZAKHONO BUILDER

Visual, credits-free application factory and owned-first infrastructure control plane for IZAKHONO projects.

## Architecture

**GOAL → IZAKHONO AI AGENT → IZAKHONO BUILDER → SOFTWARE NODE → BUILD → TEST → EVIDENCE → DEPLOY**

IZAKHONO owns the source-of-truth state, validated source snapshots, provisioning workflow and preferred production runtime. Software NODE is the primary infrastructure unit; physical hardware is an optional execution substrate. External infrastructure is replaceable and reversible, not the assumed foundation.

## Hercules replacement

**IZAKHONO-native Builder is the replacement for Hercules.** It is the sole built-in Builder execution provider. Application planning, scaffolding, validation, security checks, testing and packaging run through IZAKHONO-owned code and control-plane workflows.

- No Hercules account or Hercules credits are required.
- No artificial IZAKHONO AI credits, per-prompt charges, per-build charges, or pay-per-action meter.
- Legacy external-builder endpoint settings are ignored by the native adapter.
- Execution is governed by authorization, dependencies, evidence, security and actual infrastructure capacity.
- Customer commercial access follows IZAKHONO flat-rate plans; no proprietary AI-credit wallet.

The native Builder is a deterministic software execution engine. Model-backed code generation is a separate capability and must not be represented as available unless its runtime and model provider are actually configured and verified.

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

Production activation requires an eligible Software NODE, public network reachability, DNS delegation, TLS validation, backups/restore testing and end-to-end acceptance evidence. A physical server is not a prerequisite for Software NODE instantiation or software-level build execution.
