# CONNECTA runtime health endpoint contract

This contract defines the HTTPS response required by the four-node runtime health gate. It is an integration contract, not proof that any endpoint is deployed.

## Required endpoint configuration

Configure four distinct protected GitHub Actions production environment secrets:

- `CONNECTA_NODE01_URL`
- `CONNECTA_NODE02_URL`
- `CONNECTA_NODE03_URL`
- `CONNECTA_NODE04_URL`

Each value must be an HTTPS URL for the corresponding logical/runtime node. The health gate enforces HTTPS and normal certificate validation. Do not use public plaintext HTTP endpoints or point all four variables at one generic health endpoint.

## Required JSON response

Each endpoint must return HTTP 2xx and JSON matching its own node identity:

```json
{
  "ok": true,
  "cluster": "izakhono-production",
  "runtimeNode": "NODE01"
}
```

Replace `NODE01` with the endpoint's actual identity for NODE02, NODE03 and NODE04. The `cluster` value must match exactly. A generic `{"ok":true}` response is insufficient because it cannot prove four distinct runtime identities.

## Evidence rules

- Each endpoint is checked independently over HTTPS.
- The endpoint must identify the node it represents and the canonical cluster.
- The verifier rejects missing, malformed, stale (older than five minutes), duplicated, mismatched or non-PASS node records.
- Synthetic fixtures in `test-node-cluster-evidence-verifier.sh` test the verifier only. They are never production evidence.
- A successful four-node health check certifies the runtime prerequisite only. It does not authorize public traffic.
- Public promotion remains blocked until immutable deployment identity, EDGE, TLS, DNS, external HTTPS smoke and rollback evidence are independently verified.

## Operational sequence

1. Provision four distinct logical/runtime node endpoints.
2. Configure the four protected production secrets.
3. Run **CONNECTA Owned Runtime Certification**.
4. Review and retain the resulting `connecta-node-cluster-health` artifact.
5. Run the **CONNECTA Production Promotion Gate** only after the remaining production proofs are available.

No endpoint URL or runtime result is assumed by this document.
