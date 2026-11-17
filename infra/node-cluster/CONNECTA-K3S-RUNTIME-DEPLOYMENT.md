# CONNECTA four-node K3s runtime deployment

## Purpose and boundary

This package defines four independently identifiable CONNECTA ENGINE runtime deployments inside the IZAKHONO K3s cluster:

- NODE01 — preferred primary runtime identity
- NODE02 — peer/failover runtime identity
- NODE03 — peer/failover runtime identity
- NODE04 — disaster-recovery/workload runtime identity

These are **logical software nodes**, not physical machines or workstations. Kubernetes may reschedule a logical node's pod onto another eligible host. The manifest deliberately uses preferred spreading, not physical-host pinning.

The four-node health endpoints are internal ClusterIP services. Do not expose them through NodePort or public LoadBalancer services. IZAKHONO EDGE must provide the external HTTPS health routes and the customer-facing route.

## Release image

The `CONNECTA Engine Image` GitHub Actions workflow builds the engine image and publishes:

- `ghcr.io/bevanshelton-netizen/connecta-engine:0.3.0`
- `ghcr.io/bevanshelton-netizen/connecta-engine:sha-<commit>`

The manifest currently pins the release tag `0.3.0`. For a controlled rollout, confirm the image workflow succeeded and the registry contains that tag before applying the manifest. If GHCR keeps the package private, create the `ghcr-pull-secret` in the `connecta` namespace and attach a read-only `read:packages` credential to it.

## Required IZAKHONO-owned services

The four deployments share:

1. An IZAKHONO-owned PostgreSQL database exposed privately to the cluster.
2. An IZAKHONO-owned S3-compatible media/object-storage endpoint.
3. IZAKHONO EDGE for all public customer and health routes.

This manifest does not create a database, object store, public ingress, or TLS certificate. Those services must already exist and be reachable over private cluster networking. A single-host local Compose database is suitable for bootstrap/testing, not a four-node HA production data plane.

## Secret preparation

Create namespace first:

```bash
kubectl apply -f infra/node-cluster/connecta-runtime.yaml --dry-run=client
kubectl create namespace connecta --dry-run=client -o yaml | kubectl apply -f -
```

Create the image pull secret if the GHCR package is private:

```bash
kubectl -n connecta create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username='<registry-reader>' \
  --docker-password='<read-packages-token>' \
  --docker-email='<operator-email>'
```

Create four independent health tokens (32 random bytes each):

```bash
for node in NODE01 NODE02 NODE03 NODE04; do openssl rand -hex 32; done
```

Store the resulting values securely; do not paste them into source control or logs. Create `connecta-runtime-secrets` in the `connecta` namespace with these keys:

- `database-url`
- `owner-key`
- `node01-health-token`
- `node02-health-token`
- `node03-health-token`
- `node04-health-token`
- `s3-endpoint`
- `s3-region`
- `s3-bucket`
- `s3-prefix`
- `s3-access-key-id`
- `s3-secret-access-key`
- `s3-force-path-style`
- `allowed-origins` (optional)

Each node's token must match the corresponding protected GitHub Actions secret `CONNECTA_NODE01_HEALTH_TOKEN` through `CONNECTA_NODE04_HEALTH_TOKEN`. The database URL must point to the same shared database for all four deployments. The S3 credentials must point to shared IZAKHONO-controlled media storage.

## Apply and route

After the image and secrets are available:

```bash
kubectl apply -f infra/node-cluster/connecta-runtime.yaml
kubectl -n connecta get deployments,pods,services,pdb
```

Customer traffic routes through `connecta-engine.connecta.svc.cluster.local:4100`. IZAKHONO EDGE must route four distinct HTTPS health hostnames to:

- `connecta-node01-health.connecta.svc.cluster.local:4100/health/cluster`
- `connecta-node02-health.connecta.svc.cluster.local:4100/health/cluster`
- `connecta-node03-health.connecta.svc.cluster.local:4100/health/cluster`
- `connecta-node04-health.connecta.svc.cluster.local:4100/health/cluster`

The EDGE route must preserve the `Authorization` and `X-IZAKHONO-Probe-Nonce` headers. Public health URLs must be HTTPS and must not contain credentials.

Configure those four EDGE URLs as `CONNECTA_NODE01_URL` through `CONNECTA_NODE04_URL` in the protected GitHub production environment. Then run **CONNECTA Owned Runtime Certification**. The health gate verifies each endpoint's bearer token, fresh HMAC challenge, logical identity, cluster identity and timestamp.

## Safety and rollout rules

- The application Service and four health Services are ClusterIP-only.
- Database and storage credentials are Kubernetes Secret references, never embedded in this manifest.
- The four engine pods share one database and one object store; migrations use a PostgreSQL advisory lock so concurrent startup does not race schema changes.
- Readiness checks database and storage; liveness checks the process port to avoid restarting healthy processes during a temporary dependency outage.
- A PodDisruptionBudget keeps at least three of four runtime pods available during voluntary disruptions.
- No public traffic is authorized by applying this manifest or by passing the runtime health gate alone. Immutable release identity, EDGE, TLS, DNS, external smoke and rollback proofs remain separate promotion gates.

## Current status

This is a deployable K3s manifest and operator runbook, not a deployment receipt. It becomes runtime evidence only after the image, shared services, secrets, EDGE routes and four healthy pod instances are actually provisioned and tested.
