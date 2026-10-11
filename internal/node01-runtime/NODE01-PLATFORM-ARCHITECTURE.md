# IZAKHONO NODE01 — Platform Architecture

## Mission

NODE01 is IZAKHONO's owned compute foundation. It is not a deployment target for one application; it is the first appliance in an expandable private cloud platform.

## Layers

### 1. Physical foundation

Enterprise rack server, ECC memory, redundant boot/workload storage, dual power, UPS, BMC and redundant production networking.

### 2. Host foundation

Hardened supported Linux, firewall, security updates, time synchronisation, Docker/OCI and systemd recovery.

### 3. Sovereign control plane

The NODE01 runtime exposes the controlled management API on port 8090. It validates workload image namespace, port and deployment intent. It does not receive the Docker socket.

### 4. Private platform network

Services communicate over the private `izakhono` network. The OCI registry remains localhost-only. Public exposure is an explicit edge decision.

### 5. Workload layer

Initial production workload: IZAKHONO SUPER SEO on port 8097. The same contract can host Builder, Provisioner, KORA, FAISReady and future IZAKHONO services.

### 6. Edge layer

Owned reverse proxy/TLS gateway terminates external traffic and routes only to healthy workloads. Public DNS and certificates are separate deployment concerns and must never be represented as live until verified.

### 7. Resilience layer

Daily backups, SHA-256 manifests, registry backup, workload inventory, restore procedures and NODE02 replication policy provide the recovery foundation.

## Workload lifecycle

`candidate → pulled → starting → health-checking → healthy → promoted`

Failure path:

`starting/healthy → unhealthy → rollback → previous healthy image`

A workload cannot be promoted merely because its image built successfully.

## NODE02

NODE02 is the warm-standby recovery node. Replication includes approved artifacts, configuration, deployment policies, workload manifests, registry metadata and image digests. Secrets are provisioned independently and never copied through Git.

## Commercial evolution

NODE01 is the seed of the IZAKHONO private cloud:

1. Hosted applications
2. Managed websites and APIs
3. Automated customer provisioning
4. Private business environments
5. Dedicated customer nodes
6. Multi-node private cloud
7. Enterprise/Government sovereign workloads

## Non-negotiable rules

- Owned-first.
- External infrastructure is reversible fallback.
- No unverified production claims.
- No public registry.
- No Docker socket in the network-facing control plane.
- Health before promotion.
- Backup before recovery.
- Recovery before scale.
