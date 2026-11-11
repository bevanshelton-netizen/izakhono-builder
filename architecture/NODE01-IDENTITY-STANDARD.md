# IZAKHONO SYSTEM ARCHITECTURE STANDARD
## NODE01 identity — mandatory, system-wide

**NODE01 IS SOFTWARE. NODE01 IS NOT PHYSICAL INFRASTRUCTURE.**

NODE01 is the logical identity of IZAKHONO software: its software runtime, control-plane identity, execution logic and governed capabilities. It is not a physical server, computer, laptop, VM, machine, hardware device, network appliance, cloud instance, container host or hostname.

### Required separation
- **Software identity:** NODE01. This identity is stable and independent of where it executes.
- **Execution environment:** a separately managed and replaceable environment in which NODE01 software runs. It may be physical, virtual, containerised, distributed, cloud-based or another approved substrate.
- **Runtime binding:** an explicit configuration relationship connecting NODE01 software to an execution environment. The binding does not turn that environment into NODE01.
- **Infrastructure:** compute, storage, network, operating systems, containers, edge services and other supporting resources. None of these is NODE01.

### Invariants
1. NODE01 always refers to software.
2. Never describe, label, configure, provision, monitor, bill or document a physical machine or host as NODE01.
3. Hostnames, server names, IP addresses, VM names, container IDs and cloud resource IDs belong to the execution-environment layer, never to NODE01's identity.
4. Moving, replacing, scaling, migrating or losing an execution environment does not change NODE01's software identity.
5. Multiple execution environments may support the same NODE01 software identity where the architecture permits.
6. NODE01 software may orchestrate or govern infrastructure, but must not be conflated with that infrastructure.
7. Configurations must use distinct fields for logical software identity and execution-environment locator; never overload one field for both.
8. Logs, APIs, manifests, CI/CD, installers, service definitions, telemetry, AI-agent instructions and documentation must preserve this distinction.
9. Any ambiguous or contradictory mapping must fail closed and require correction; it must not silently redefine NODE01 as hardware.
10. This standard takes precedence over older wording anywhere in the IZAKHONO system.

### Canonical configuration vocabulary
- `logical_node_id: NODE01`
- `identity_type: software-runtime`
- `runtime_host` or equivalent: locator for the separate execution environment only
- `runtime_host_is_separate: true`

### Required language
Say: “NODE01 software runs in/on the separately managed execution environment.”
Do not say: “NODE01 server”, “NODE01 machine”, “the NODE01 hardware”, or use NODE01 as a hostname or infrastructure resource.

### Scope
This standard applies to every IZAKHONO company system, product, repository, service, agent, workflow, environment, integration and future project. Product-specific documentation may explain implementation details but may not weaken or redefine this identity rule.
