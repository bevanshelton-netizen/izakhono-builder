# IZAKHONO SOFTWARE NODE v1

## Decision

The IZAKHONO Software NODE is the primary infrastructure unit.

A physical server is **not** a prerequisite for NODE creation, promotion, workload scheduling or cluster formation. Physical hardware is an optional execution substrate and capacity source.

**Software is the machine.**

## Node contract

A Software NODE must expose a provider-neutral capability contract:

- identity and authentication
- container/runtime capability
- persistent storage capability
- network reachability
- workload lifecycle
- health and heartbeat evidence
- backup/restore evidence
- security/FORTRESS evidence
- monitoring evidence
- promotion/demotion state

The node contract must remain independent of the underlying compute provider.

## Execution substrates

The same NODE contract may run on:

1. IZAKHONO-owned compute
2. virtual machines
3. containers
4. temporary external compute
5. future dedicated hardware

The substrate must never become part of the application contract.

## Promotion rule

A Software NODE is promoted only when its runtime evidence satisfies the NODE contract. A machine does not become authoritative merely because it exists; likewise, a virtual node does not become authoritative merely because it has been configured.

Promotion requires evidence, including:

- node identity
- authenticated control relationship
- runtime available
- persistent storage available
- fresh heartbeat
- backup evidence
- security/FORTRESS evidence
- monitoring evidence

## Cluster model

The control plane creates and manages logical nodes. Nodes can be replicated and replaced without changing customer workloads.

Example:

`CONTROL → NODE-A → KORA`

can become:

`CONTROL → NODE-A + NODE-B + NODE-C → KORA`

without changing KORA's application contract.

## Failover

If a node becomes stale, unhealthy or unavailable, the control plane must:

1. stop scheduling new work to that node;
2. preserve the last known evidence;
3. select another promoted node;
4. restore or redeploy the workload;
5. verify workload health;
6. record the promotion/failover event.

No automatic failover may promote an unverified node.

## KORA application rule

KORA must consume the IZAKHONO runtime contract rather than a Vercel-specific runtime contract. Vercel and other providers remain reversible capacity adapters until an IZAKHONO Software NODE is independently verified for the required workload.

## Infrastructure principle

The objective is not to own the most machines. The objective is to own the **control, workload definitions, provisioning, security, data portability and operational intelligence** that can make available compute behave as IZAKHONO infrastructure.
