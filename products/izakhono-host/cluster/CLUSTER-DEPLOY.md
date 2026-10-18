# IZAKHONO Owned Cluster Deployment

This is the execution order for the owned multi-node host. It deliberately does not depend on Vercel or Netlify.

## 1. Assign roles

- NODE01: CONTROL + EDGE + RUNTIME
- NODE02: EDGE + RUNTIME + DNS secondary
- NODE03: EDGE + RUNTIME + DNS secondary + BACKUP
- Optional dedicated DATA, MAIL and FORTRESS nodes can be added without changing the runtime contract.

Node names are logical identifiers until their actual addresses are supplied by the infrastructure environment.

## 2. Run preflight on every node

```bash
./NODE-PREFLIGHT.sh
```

A node is not accepted until Docker/Compose, required ports, storage and secrets are available.

## 3. Activate the owned runtime

On the control/runtime node:

```bash
./NODE01-ACTIVATE.sh
```

The activation script runs preflight before bootstrap and verifies the local health endpoint.

## 4. Network acceptance gates

Before public production acceptance, verify:

- TCP/UDP 53 reaches the authoritative DNS nodes where delegation requires it.
- TCP 80 and 443 reach the edge nodes.
- IPv4 and IPv6 routing work where advertised.
- The domain registrar delegates to the IZAKHONO authoritative nameservers.
- HTTPS certificates are issued and renewed by the owned edge layer.

Do not mark a site `live` from configuration alone. Public reachability must be tested from outside the cluster.

## 5. Data and backup acceptance

The runtime state, PostgreSQL data, object storage and configuration must have a recoverable backup. Restore testing is a release gate, not an optional task.

## 6. Final production acceptance

A site becomes production-live only when DNS, HTTPS and content have all passed independent verification. The runtime records these acceptance dimensions and exposes `public_live` only when all three are true.
