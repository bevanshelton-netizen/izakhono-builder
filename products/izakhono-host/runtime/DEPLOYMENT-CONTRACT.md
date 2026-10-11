# IZAKHONO Runtime Deployment Contract

The Runtime is the primary deployment target. External hosting adapters are continuity fallbacks only.

## Request

`POST /api/deployments`

Required:
- `app`: stable application identifier
- `image`: immutable OCI image reference

Optional:
- `digest`: content digest
- `domain`: canonical hostname
- `health_path`: application health endpoint (default `/healthz`)
- `env`: non-secret runtime environment references

## State machine

`scheduled → running → verified → production`

Failure states:

`scheduled/running → failed`

Recovery:

`production → rolled_back`

Promotion is forbidden until the health gate succeeds. Traffic changes are therefore atomic at the control-plane route layer.

## Node contract

Every compute node must expose:

- heartbeat
- health endpoint
- deployment endpoint
- deployment status
- drain state
- capacity information

A node is replaceable compute capacity. The control plane remains the source of truth.

## Edge contract

The edge layer consumes the control-plane route table and must:

1. resolve the requested host;
2. select the current healthy revision;
3. proxy traffic to the selected node;
4. return a controlled `503` when no healthy route exists;
5. never route traffic to a failed or unverified revision.

## Acceptance gate

A workload is considered IZAKHONO-native only when the same immutable artifact can be:

1. scheduled to a node;
2. started;
3. health-checked;
4. promoted;
5. served through the edge;
6. rolled back without a third-party deployment platform.

DNS and registrar providers remain external network adapters where necessary; the deployment authority does not.
