# CONNECTA Runtime Certification

## Canonical production model

`IZAKHONO CODE → IZAKHONO CONTROL → NODE01 → NODE02 → NODE03 → NODE04 → IZAKHONO EDGE/TLS → CONNECTA`

The four nodes are logical/runtime execution nodes. A physical NODE01 workstation is not required.

## 1. Provision distinct HTTPS runtime endpoints

Configure these protected GitHub Actions production environment secrets:

- `CONNECTA_NODE01_URL`
- `CONNECTA_NODE02_URL`
- `CONNECTA_NODE03_URL`
- `CONNECTA_NODE04_URL`

Each URL must point to its own logical/runtime node over HTTPS. All four URLs must not resolve to one generic endpoint.

Every endpoint must return HTTP 2xx and JSON that identifies itself and the canonical cluster. Example for NODE01:

```json
{
  "ok": true,
  "cluster": "izakhono-production",
  "runtimeNode": "NODE01"
}
```

NODE02, NODE03 and NODE04 must return their respective `runtimeNode` identity. The health gate rejects plaintext HTTP, generic health responses, mismatched node identity and mismatched cluster identity. See [CONNECTA runtime health endpoint contract](CONNECTA-RUNTIME-HEALTH-ENDPOINT-CONTRACT.md).

## 2. Collect actual runtime evidence

The manual **CONNECTA Owned Runtime Certification** workflow reads the four protected endpoint secrets, runs the health gate, verifies evidence freshness and identity, and retains the evidence artifact.

For a controlled operator run:

```bash
NODE01_URL=https://node01.example.invalid/health \
NODE02_URL=https://node02.example.invalid/health \
NODE03_URL=https://node03.example.invalid/health \
NODE04_URL=https://node04.example.invalid/health \
OUTPUT=/tmp/connecta-node-cluster-health.json \
bash infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh

bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh /tmp/connecta-node-cluster-health.json
```

The `.example.invalid` hostnames above are placeholders only, not deployed endpoints.

## 3. Evaluate promotion prerequisite

```bash
bash infra/node-cluster/CONNECTA-PROMOTION-GATE.sh /tmp/connecta-node-cluster-health.json
```

Missing, malformed, stale, simulated, inferred, topology-only, CI-only, repository-only, duplicate, or identity-mismatched evidence is rejected.

## 4. Full activation

Runtime-cluster certification alone does **not** authorize public traffic. Full activation additionally requires independently verified immutable deployment identity, EDGE, TLS, DNS, external HTTPS smoke, and rollback evidence. The promotion workflow deliberately exits blocked until those additional proofs are present; a green runtime prerequisite is not a production promotion.

## Deprecated flow

Do not use the legacy physical/workstation-oriented `CERTIFY-WAVE1-OWNED.ps1`, `PUSH-WAVE1-OWNED.ps1`, Desktop NODE01 reports, or local NODE01 launcher as CONNECTA production proof. See `infra/runtime-fabric/LEGACY-NODE01-WAVE1-DEPRECATION.md`.
