# IZAKHONO SOFTWARE NODE — ARCHITECTURE

```text
                 IZAKHONO CONTROL PLANE
                          |
                 NODE REGISTRY / POLICY
                          |
        +-----------------+-----------------+
        |                 |                 |
   SOFTWARE NODE A   SOFTWARE NODE B   SOFTWARE NODE C
        |                 |                 |
     runtime           runtime           runtime
     storage           storage           storage
     edge              edge              edge
        \                 |                 /
         +---------------+----------------+
                         |
                 CUSTOMER WORKLOADS
                         |
                       KORA
```

## Core layers

### 1. Control

Logical node identity, scheduling, policy, promotion, demotion, workload placement and audit.

### 2. Node agent

Provider-neutral local/remote execution contract. The existing `autonomy/node-agent.mjs` remains the reference implementation for inspect/promote semantics.

### 3. Runtime

Containerized application workloads. Workloads are portable and do not encode assumptions about the underlying host.

### 4. Storage

Persistent storage is an explicit capability. Storage paths, object storage and database services are abstracted behind workload contracts.

### 5. Edge

DNS, routing, TLS and ingress are separate capabilities. They are not tied to a particular compute machine.

### 6. Evidence

Heartbeat, health, backup, security and monitoring evidence determine node eligibility.

## Software-first consequence

A node can be instantiated without purchasing or physically installing a server. Compute is capacity; the IZAKHONO node contract is the infrastructure abstraction.

## Safety rule

No provider is declared "owned" solely because IZAKHONO controls configuration. Ownership/promotion requires runtime evidence and a successful workload acceptance test.

## Migration rule

KORA remains on its current production provider until an alternate Software NODE passes workload-specific acceptance. Migration is then a controlled routing change with rollback preserved.
