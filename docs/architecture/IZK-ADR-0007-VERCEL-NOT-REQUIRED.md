# Architecture Decision: Vercel Is Not Required

- **Decision ID:** IZK-ADR-0007
- **Status:** ACCEPTED
- **Scope:** CONNECTA and the IZAKHONO runtime fabric
- **Decision:** IZAKHONO-controlled NODE01–NODE04 and IZAKHONO EDGE are the canonical runtime and routing architecture. Vercel is not required and must not be treated as a production dependency, deployment target, failover prerequisite, or launch gate.

## Consequences

1. CONNECTA must build and deploy from its immutable release artifact to IZAKHONO-controlled runtime nodes.
2. Runtime health, failover, backup/restore, EDGE, TLS, DNS, external HTTPS smoke and rollback must be certified without relying on Vercel.
3. CI providers may run tests and release automation but do not constitute the production runtime.
4. Optional specialist services (for example DNS registration or certificate issuance) must be portable, replaceable and explicitly approved; they must not host or control the application runtime.
5. Existing Vercel projects/accounts are not deleted by this decision. They are outside the required architecture. Any deletion or account closure requires a separate inventory and explicit change plan.
6. No live/deployed claim is permitted until actual four-node runtime and all production evidence gates pass.

## Verification

The canonical runtime standards and CONNECTA certification instructions must explicitly state that Vercel is not required. CI must continue to fail closed when actual runtime evidence is absent.
