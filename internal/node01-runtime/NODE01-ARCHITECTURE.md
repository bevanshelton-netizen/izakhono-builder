# IZAKHONO NODE01 Software — Runtime Architecture

## Locked identity

**NODE01 IS SOFTWARE. NODE01 IS NOT A PHYSICAL MACHINE.**

NODE01 is the stable IZAKHONO software/runtime identity. Its execution environment is separately managed and replaceable. The machine previously used for execution has been replaced; that replacement does not create a new NODE01 identity.

```text
NODE01 SOFTWARE IDENTITY
        |
        | runtime binding (separate locator)
        v
REPLACEMENT EXECUTION ENVIRONMENT
        |
        +-- operating system / runtime
        +-- containers and application workloads
        +-- storage and backup adapters
        +-- network and edge connectivity
```

The diagram describes an architecture boundary, not proof that any particular environment is currently connected or healthy.

## Layers

### 1. NODE01 software
The control-plane/runtime software owns workload intent, release identity, health policy and deployment contracts. It does not become the machine that executes it.

### 2. Execution environment
A separately managed physical host, VM, VPS, cloud runtime, container host or serverless substrate may execute NODE01 software. Its actual locator is stored only in the runtime binding. It can be replaced without changing NODE01.

### 3. Host operating system and runtime adapter
Where the selected environment requires an operating system, container runtime, firewall or service manager, those are properties of the execution environment—not NODE01 identity.

### 4. Workload plane
Applications run through approved isolated workloads with explicit image, port and health contracts.

### 5. Registry and artifact storage
Artifacts are immutable and separately identified. A registry is an optional execution/deployment dependency, not NODE01 itself.

### 6. Edge
Public traffic terminates at the approved edge. Routes point only to independently verified healthy workloads.

### 7. Observability
Health, release identity, storage capacity, backup age and heartbeat are operational signals. They must identify the software identity and actual execution environment separately.

### 8. Recovery and replacement
When an execution environment is replaced, update the binding, re-establish the software runtime, restore approved state and run acceptance. Do not rename the new machine NODE01 or mint a new NODE01 identity.

## Production gate

`production_ready = valid_binding AND runtime_healthy AND workload_healthy AND backup_restore_verified AND route_verified`

Repository files, topology diagrams, CI success or a configured placeholder do not prove runtime readiness. Missing or unverified evidence remains BLOCKED.
