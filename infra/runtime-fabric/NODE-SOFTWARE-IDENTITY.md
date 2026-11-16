# IZAKHONO Software Node Identity Standard

**Status:** Canonical architecture definition  
**Applies to:** NODE01, NODE02, NODE03, NODE04 and all products using the IZAKHONO Runtime Fabric.

## 1. What NODE01 is

**NODE01 is IZAKHONO software.** It is a deployable software runtime component/service in the IZAKHONO platform. It is not a desktop, workstation, laptop, physical server, hostname, rack, or cloud provider.

NODE01 may execute on a physical or virtual host, inside a container, or across approved IZAKHONO-controlled compute. The host supplies execution capacity; it is not NODE01.

## 2. Four-node software cluster

- **NODE01:** primary IZAKHONO software node.
- **NODE02:** peer/failover IZAKHONO software node.
- **NODE03:** peer/control-plane IZAKHONO software node.
- **NODE04:** disaster-recovery/backup IZAKHONO software node.

All four are software node components/instances. Their runtime hosts are separately provisioned, replaceable infrastructure. Replacing or migrating a host must not rename, erase, or redefine the software node.

## 3. Architecture boundary

`IZAKHONO CODE → IZAKHONO CONTROL → NODE01/NODE02/NODE03/NODE04 SOFTWARE CLUSTER → IZAKHONO EDGE/TLS → PRODUCT RUNTIMES`

- IZAKHONO CODE builds and versions the software.
- IZAKHONO CONTROL provisions, configures, schedules and governs node software.
- NODE01–NODE04 execute the approved software workloads and provide cluster resilience.
- IZAKHONO EDGE/TLS provides controlled public ingress and health-aware routing.
- Underlying hosts, networks, storage and power are infrastructure dependencies, not node identities.

## 4. Evidence and activation

A software node is not certified merely because its source code, configuration, container image, topology entry or CI job exists. Runtime certification must prove the actual software node instance is running the approved immutable release, reports its own logical identity, is healthy, and is reachable through the approved private/edge path.

No evidence may infer NODE01 health from a physical workstation, a repository declaration, or another node's generic health response. Each node endpoint must identify its own logical software node and the canonical cluster.

Missing, stale, simulated, inferred, topology-only, CI-only or repository-only evidence keeps activation blocked. Public LIVE status requires all deployment, node, EDGE, TLS, DNS, smoke-test and rollback gates to pass.

## 5. Terminology rule

Use **“NODE01 software node”** or **“NODE01 software runtime”**. Use **“runtime host”** for the underlying machine/VM/compute capacity. Never use the terms interchangeably.
