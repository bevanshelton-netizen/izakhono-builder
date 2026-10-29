# CONNECTA Runtime Certification

## Canonical production model

`IZAKHONO CODE → IZAKHONO CONTROL → NODE01 → NODE02 → NODE03 → NODE04 → IZAKHONO EDGE/TLS → CONNECTA`

The four nodes are logical/runtime execution nodes. A physical NODE01 workstation is not required.

## Certification order

### 1. Runtime evidence

Set the actual runtime endpoints for:

- `NODE01_URL`
- `NODE02_URL`
- `NODE03_URL`
- `NODE04_URL`

Run:

```bash
NODE01_URL=... NODE02_URL=... NODE03_URL=... NODE04_URL=... \
OUTPUT=/tmp/connecta-node-cluster-health.json \
infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh
```

### 2. Evidence verification

```bash
bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh /tmp/connecta-node-cluster-health.json
```

The evidence must prove all four nodes are healthy, belong to `izakhono-production`, and were observed from runtime endpoints.

### 3. Promotion gate

```bash
bash infra/node-cluster/CONNECTA-PROMOTION-GATE.sh /tmp/connecta-node-cluster-health.json
```

Missing, malformed, simulated, inferred, topology-only, CI-only, or repository-only evidence is rejected.

### 4. Full activation

Runtime-cluster certification alone does **not** authorize public traffic. Full activation additionally requires deployment identity, EDGE, TLS, DNS, external HTTPS smoke, and rollback evidence.

## Deprecated flow

Do not use the legacy physical/workstation-oriented `CERTIFY-WAVE1-OWNED.ps1`, `PUSH-WAVE1-OWNED.ps1`, Desktop NODE01 reports, or local NODE01 launcher as CONNECTA production proof. See `infra/runtime-fabric/LEGACY-NODE01-WAVE1-DEPRECATION.md`.
