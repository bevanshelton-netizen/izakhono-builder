# CONNECTA runtime health endpoint contract

This contract defines the authenticated HTTPS challenge required by the four-node runtime health gate. It is an integration contract, not proof that any endpoint is deployed.

## Required protected production secrets

Configure eight protected GitHub Actions production-environment secrets:

- `CONNECTA_NODE01_URL`
- `CONNECTA_NODE02_URL`
- `CONNECTA_NODE03_URL`
- `CONNECTA_NODE04_URL`
- `CONNECTA_NODE01_HEALTH_TOKEN`
- `CONNECTA_NODE02_HEALTH_TOKEN`
- `CONNECTA_NODE03_HEALTH_TOKEN`
- `CONNECTA_NODE04_HEALTH_TOKEN`

Each URL must be a distinct HTTPS URL for its corresponding logical/runtime node. Each health token must be a unique 32-byte random value encoded as 64 hexadecimal characters. Generate each token independently, for example with `openssl rand -hex 32`. Never reuse a token between nodes, commit tokens to source control, or place tokens in a URL.

The corresponding runtime instance must be configured with:

- `IZAKHONO_NODE_ID` — exactly NODE01, NODE02, NODE03 or NODE04
- `IZAKHONO_CLUSTER_ID` — exactly `izakhono-production`
- `IZAKHONO_NODE_HEALTH_TOKEN` — that node's matching 64-character token

## Endpoint

The CONNECTA engine exposes:

`GET /health/cluster`

The request must contain:

- `Authorization: Bearer <node-health-token>`
- `X-IZAKHONO-Probe-Nonce: <64-hex-character-random-nonce>`

The endpoint must return HTTP 2xx and JSON matching the challenge:

```json
{
  "ok": true,
  "cluster": "izakhono-production",
  "runtimeNode": "NODE01",
  "authScheme": "bearer-hmac-sha256",
  "probeNonce": "<the exact request nonce>",
  "probeSignature": "<HMAC-SHA256 hex signature>"
}
```

Replace NODE01 with the endpoint's actual logical node identity. The signature is HMAC-SHA256 using the node's 32-byte token as the key and this UTF-8 message:

```text
izakhono-production
NODE01
<probe nonce>
```

The health gate verifies the nonce and signature with constant-time comparison. It never writes the token or Authorization header to the evidence artifact.

The endpoint also checks the runtime's database and storage health before returning `ok: true`. A missing node identity, wrong cluster, missing token, invalid nonce or unavailable dependency must not produce a passing response.

## Evidence rules

- Every node is probed independently over HTTPS with its own unique credential.
- Endpoint URL reuse and credential reuse are rejected.
- The endpoint must prove its own runtime identity and the canonical cluster.
- A fresh 256-bit nonce is generated for each probe; replayed or mismatched challenges fail.
- The verifier rejects missing, malformed, stale (older than five minutes), duplicated, mismatched, unsigned or non-PASS node records.
- Synthetic fixtures in the node-cluster tests test the verifier only. They are never production evidence.
- A successful four-node health check certifies the runtime prerequisite only. It does not authorize public traffic.
- Public promotion remains blocked until immutable deployment identity, EDGE, TLS, DNS, external HTTPS smoke and rollback evidence are independently verified.

## Operational sequence

1. Provision four distinct logical/runtime node endpoints.
2. Generate four independent 32-byte health tokens.
3. Configure the four URL and four health-token secrets in the GitHub production environment.
4. Configure each runtime instance with its matching node ID, cluster ID and health token.
5. Run **CONNECTA Owned Runtime Certification**.
6. Review and retain the resulting `connecta-node-cluster-health` artifact.
7. Run the **CONNECTA Production Promotion Gate** only after the remaining production proofs are available.

No endpoint URL, token or runtime result is assumed by this document.
