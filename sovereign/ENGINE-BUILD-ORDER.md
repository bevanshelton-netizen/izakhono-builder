# IZAKHONO Sovereign Engine Build Order

## Wave 1 — Control independence
- SOURCE ENGINE: local repository/worktree and immutable artifact storage
- DATA ENGINE: local durable state with backup/restore
- OBJECT STORE: content-addressed local storage
- QUEUE ENGINE: persistent job queue
- IDENTITY ENGINE: local accounts, sessions, roles and capability tokens

## Wave 2 — Software production independence
- BUILD & CI ENGINE: local isolated builds/tests
- RUN ENGINE: sandboxed execution adapters
- DEPLOY ENGINE: local/container/static release targets
- REGISTRY ENGINE: packages, images, releases and deployment manifests

## Wave 3 — Infrastructure independence
- HOSTING FABRIC: node scheduling and workload placement
- DNS ENGINE: authoritative records and provider adapters
- CERT ENGINE: certificate lifecycle and ACME adapters
- MAIL ENGINE: transactional/system mail with relay adapters
- BACKUP/REPLICATION ENGINE: snapshots, replication and recovery

## Wave 4 — Intelligence independence
- AI GATEWAY: model-agnostic routing
- SUPER AI orchestration: coding/build/test/deploy agents
- OBSERVABILITY ENGINE: metrics, logs, traces, audit
- SECURITY ENGINE: policy, capability enforcement, secrets and threat controls

## Wave 5 — Commercial independence
- PROVISIONER: payment verification → provisioning job → build → test → approval → release
- WEBSITE FACTORY: repeatable customer deployments
- BILLING/ENTITLEMENT ENGINE
- CUSTOMER CONTROL PLANE

## Architectural constraint
No engine may require GitHub, Vercel, Cloudflare or Supabase to perform its core function. Providers are adapters selected by policy.
