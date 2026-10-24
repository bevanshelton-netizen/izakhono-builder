# IZAKHONO NODE MESH V1

## Purpose

Define the IZAKHONO production node layer as software-defined infrastructure. A NODE is a controlled runtime identity, not a particular physical machine. Underlying compute may be moved, replaced, virtualized or recovered without changing the IZAKHONO control-plane contract.

## Production topology

| Node | Role | Default responsibility |
| --- | --- | --- |
| NODE01 | Primary | Control-plane coordination, primary application/runtime workloads, provisioning |
| NODE02 | Secondary | Failover, recovery, replica workloads and controlled promotion |
| NODE03 | Capacity | Additional compute, build/runtime capacity and workload expansion |
| NODE04 | Recovery/Scale | Recovery capacity, backup restore target and future scale-out |

These roles are logical. A node may run on virtualized or bare-metal compute. The control plane owns node identity, health, workload placement and promotion state.

## Control contract

IZAKHONO CONTROL remains authoritative for:

- node identity and registration
- health/heartbeat state
- workload placement
- deployment version
- secrets references (never plaintext secrets in source)
- backup/restore state
- rollback state
- promotion/failback state
- audit evidence

A workload must not depend on the physical identity of a node.

## KORA production placement

KORA is Customer Zero for IZAKHONO HOST.

Default placement:

`NODE01 -> KORA primary`

Recovery/scale path:

`NODE02 -> NODE03 -> NODE04`

Promotion is evidence-gated. A secondary node is not declared production merely because it is configured; it must pass health, dependency, backup/restore and acceptance checks.

## KORA mail placement

The KORA mail workload is a managed IZAKHONO HOST service:

`KORA -> IZAKHONO MAIL -> mail.streamkoraafrica.com -> info@streamkoraafrica.com`

Mail promotion requires successful DNS, TLS, SMTP, IMAP, SPF, DKIM, DMARC, inbound, outbound and reply acceptance. No mailbox is marked LIVE VERIFIED from configuration alone.

## Failure policy

1. Detect unhealthy primary node/workload.
2. Preserve customer data and secrets.
3. Select the healthiest eligible node.
4. Restore or promote from the latest verified state.
5. Run application and dependency acceptance.
6. Record evidence.
7. Promote public traffic only after acceptance passes.
8. Fail back when the primary is healthy and a controlled rollback/failback test passes.

No destructive failover action is implicit. Public DNS, payments and customer-data cutovers remain evidence-gated.

## Provider independence

External infrastructure may be used as a reversible bridge while an owned route is being validated. It must not become an architectural dependency for IZAKHONO products.

## Status rule

Allowed state progression:

`DESIGNED -> BUILT -> VALIDATED -> NODE-VERIFIED -> PUBLIC-VERIFIED -> OWNED LIVE VERIFIED`

Never skip an evidence gate and never claim a node or workload is live without corresponding verification evidence.
