# FORTRESS DNS Publication Authorization v1

## Purpose

Provide the policy decision boundary required before an IZAKHONO-owned DNS zone can be published to authoritative nameservers. This module is an authorization contract, not a deployment executor.

## Authorization policy

- Only active FORTRESS OWNER and SECURITY_ADMIN principals receive `dns:publish`.
- The principal tenant must exactly match the DNS zone tenant.
- The request is bound to one zone ID, normalized zone name, exact desired SOA serial and explicit production environment.
- A durable approval must be resolved by approval ID and match the exact tenant, action, zone resource, zone name, desired serial and environment.
- The approver must be a different principal from the executor.
- The approval must be explicitly APPROVED and not expired.
- The FORTRESS audit writer must acknowledge the ALLOWED decision before the function returns `allowed: true`.
- Denials are also audited. If audit persistence fails, the authorization call fails closed and throws; callers must not proceed.

## Integration boundary

`src/dns-deployment-authorization.ts` accepts two injected dependencies: a durable approval resolver and a durable audit writer. This keeps approval storage and audit persistence behind the canonical FORTRESS service boundary rather than inventing a second approval database.

The module is not yet wired to the HOST DNS API or Runtime Fabric execution. The next integration must provide real FORTRESS-backed implementations of both dependencies, persist a deployment request in the Runtime Fabric durable store, and pass the existing NODE01 gateway registration and dual-authority DNS placement gates before execution. No caller-supplied approval JSON may be trusted as proof.

## Safety

This change does not publish DNS, apply database migrations, create live approvals, enroll hosts, register gateway adapters, or deploy workloads. NODE01 remains a software identity/orchestration layer; actual execution must occur on separately registered and healthy HOST execution environments.
