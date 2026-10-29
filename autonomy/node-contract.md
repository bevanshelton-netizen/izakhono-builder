# IZAKHONO NODE Contract v1

## Purpose

Provide a stable software-defined contract between the continuous execution engine and any IZAKHONO-owned runtime capacity.

The underlying capacity may be a physical node, virtual machine, container host, or future software-defined runtime. The execution engine must not depend on the identity of a particular machine.

## Required operations

### inspect
Returns capability evidence for:

- container runtime
- persistent storage
- network egress
- public ingress
- backup
- monitoring
- FORTRESS security

### promote
Requests promotion of the verified runtime into the owned execution queue.

Promotion requires evidence for:

- container-runtime-ready
- persistent-storage-ready
- backup-tested
- security-gate-passed
- monitoring-online

## Authentication

Node credentials are runtime secrets only. They must never be committed to source control or exposed to browser code.

## Design rule

**Software-defined first. Physical node capacity second.**

The contract abstracts the physical layer so capacity can be replaced, replicated, consolidated or moved without changing the customer provisioning contract.

## Failure behavior

- unavailable node: `waiting`
- unsuccessful operation: `failed`
- verified capability: `ready`

No production or LIVE claim may be made from code existence alone. Physical reachability and acceptance evidence remain mandatory.
