# CONNECTA Runtime Certification

## Canonical production model

`IZAKHONO CODE → IZAKHONO CONTROL → NODE01 → NODE02 → NODE03 → NODE04 → IZAKHONO EDGE/TLS → CONNECTA`

**NODE01 is IZAKHONO software**: a deployable runtime component/service. NODE02, NODE03 and NODE04 are peer/failover software nodes. They execute on infrastructure hosts; they are not physical machines or workstations. A physical NODE01 workstation is neither the software nor a requirement. **Vercel is not required, not the CONNECTA runtime, and not a production dependency.** CONNECTA must build, deploy, route and operate on IZAKHONO-controlled infrastructure.

## Owned runtime deployment package

The four logical CONNECTA runtime deployments are defined in `infra/node-cluster/connecta-runtime.yaml`. The operator runbook is `infra/node-cluster/CONNECTA-K3S-RUNTIME-DEPLOYMENT.md`. The engine image is built and published by `.github/workflows/connecta-engine-image.yml` to `ghcr.io/bevanshelton-netizen/connecta-engine:0.3.0`.

The K3s manifest creates four separately identified engine Deployments, one internal customer Service, four internal node-health Services, and a three-of-four PodDisruptionBudget. It uses shared IZAKHONO-owned PostgreSQL and S3-compatible media storage; it does not create or assume those services, public ingress, or EDGE routing.

## 1. Provision distinct authenticated HTTPS runtime endpoints

Configure these protected GitHub Actions production-environment secrets:

- `CONNECTA_NODE01_URL`
- `CONNECTA_NODE02_URL`
- `CONNECTA_NODE03_URL`
- `CONNECTA_NODE04_URL`
- `CONNECTA_NODE01_HEALTH_TOKEN`
- `CONNECTA_NODE02_HEALTH_TOKEN`
- `CONNECTA_NODE03_HEALTH_TOKEN`
- `CONNECTA_NODE04_HEALTH_TOKEN`

Generate each token independently as a 32-byte random value encoded in 64 hexadecimal characters, for example `openssl rand -hex 32`. Never reuse credentials across nodes or commit them to source control.

Configure each runtime instance with `IZAKHONO_NODE_ID`, `IZAKHONO_CLUSTER_ID=izakhono-production` and its own `IZAKHONO_NODE_HEALTH_TOKEN`. The engine exposes `GET /health/cluster`, requires a Bearer token and signs a fresh 256-bit probe nonce using HMAC-SHA256. The health gate verifies the response signature and node identity. See [CONNECTA runtime health endpoint contract](CONNECTA-RUNTIME-HEALTH-ENDPOINT-CONTRACT.md).

## 2. Collect actual runtime evidence

The manual **CONNECTA Owned Runtime Certification** workflow reads the four protected endpoint URLs and four per-node health tokens, runs the authenticated health gate, verifies evidence freshness and identity, and retains the evidence artifact.

For a controlled operator run:

```bash
NODE01_URL=https://node01.example.invalid/health/cluster \
NODE02_URL=https://node02.example.invalid/health/cluster \
NODE03_URL=https://node03.example.invalid/health/cluster \
NODE04_URL=https://node04.example.invalid/health/cluster \
NODE01_HEALTH_TOKEN=<64-hex-token-01> \
NODE02_HEALTH_TOKEN=<64-hex-token-02> \
NODE03_HEALTH_TOKEN=<64-hex-token-03> \
NODE04_HEALTH_TOKEN=<64-hex-token-04> \
OUTPUT=/tmp/connecta-node-cluster-health.json \
bash infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh

bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh /tmp/connecta-node-cluster-health.json
```

The `.example.invalid` hostnames and token placeholders above are examples only, not deployed endpoints or credentials.

## 3. Evaluate promotion prerequisite

```bash
CONNECTA_REQUIRE_CRYPTOGRAPHIC_EVIDENCE=true \\
NODE01_HEALTH_TOKEN="$CONNECTA_NODE01_HEALTH_TOKEN" \\
NODE02_HEALTH_TOKEN="$CONNECTA_NODE02_HEALTH_TOKEN" \\
NODE03_HEALTH_TOKEN="$CONNECTA_NODE03_HEALTH_TOKEN" \\
NODE04_HEALTH_TOKEN="$CONNECTA_NODE04_HEALTH_TOKEN" \\
bash infra/node-cluster/CONNECTA-PROMOTION-GATE.sh /tmp/connecta-node-cluster-health.json
```

The promotion script forces cryptographic verification on every invocation. Four distinct protected 64-hex per-node credentials are mandatory; never use synthetic fixture tokens for promotion. Missing, malformed, stale, simulated, inferred, topology-only, CI-only, repository-only, duplicate, identity-mismatched, unauthenticated, non-HTTP-200 or invalid-HMAC evidence is rejected.

## 4. Full activation

Runtime-cluster certification alone does **not** authorize public traffic. Full activation additionally requires independently verified immutable deployment identity, IZAKHONO EDGE, TLS, DNS, external HTTPS smoke, and rollback evidence. The promotion workflow deliberately exits blocked until those additional proofs are present; a green runtime prerequisite is not a production promotion.

## Deprecated flow

Do not use the legacy physical/workstation-oriented `CERTIFY-WAVE1-OWNED.ps1`, `PUSH-WAVE1-OWNED.ps1`, Desktop NODE01 reports, or local NODE01 launcher as CONNECTA production proof. See [legacy NODE01 deprecation](../runtime-fabric/LEGACY-NODE01-WAVE1-DEPRECATION.md).
