# Owned Runtime Deployment Evidence

The Application Fabric can only move beyond repository-side provisioning when the owned runtime supplies independent evidence.

Required evidence schema: `izakhono.runtime-evidence/v1`.

Required facts:

- software/runtime node identity is one of `NODE01`–`NODE04`;
- the physical host remains separate from the logical node identity;
- the runtime is IZAKHONO-owned;
- Docker/OCI runtime is verified;
- `izakhono-edge` is verified;
- the exact immutable artifact digest is verified;
- application health is verified;
- public HTTPS is verified;
- acceptance is verified;
- `live` remains `false` until the separate release adapter promotion gate succeeds.

The repository may validate the shape and safety of this evidence. It cannot manufacture physical-node, public DNS/TLS, or production evidence. A repository CI runner is not an owned production node.

Promotion remains controlled by the hardened owned release adapter and requires the exact tested artifact identity plus rollback evidence.
