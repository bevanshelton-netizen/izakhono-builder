# IZAKHONO MACHINE v1

## Purpose

The IZAKHONO Machine is the execution layer that turns a validated application manifest into a controlled production release. Workers do not operate as isolated tasks. Each stage creates an addressable artifact and a machine-readable handoff for the next stage.

## Worker chain

1. **ARCHITECT** — defines the production contract and acceptance criteria.
2. **BUILDER** — creates the application artifact.
3. **INTEGRATOR** — connects runtime, data, identity, payments, edge and observability adapters.
4. **TESTER** — validates functional, integration, security and production acceptance gates.
5. **DEPLOYER** — applies the immutable release through the IZAKHONO-owned runtime adapter.
6. **VERIFIER** — proves health, HTTPS and customer acceptance.
7. **RELEASE MANAGER** — promotes only evidence-backed releases.
8. **OBSERVER** — monitors the live system and routes failures back to the responsible stage.

## Production pathway

`SOURCE → PLAN → BUILD → VALIDATE → PACKAGE → REGISTER → PROVISION → DEPLOY → HEALTH → HTTPS → ACCEPTANCE → PROMOTE → LIVE → MONITOR`

Deployment is therefore an output of a successful pathway, not a separate manual project.

## Handoff rule

Every worker must leave:

- a named artifact;
- a version or digest;
- acceptance criteria;
- evidence references;
- the next worker;
- a failure owner and repair action.

The handoff contract is `infra/worker-handoff.v1.json`.

## Failure rule

A normal technical failure does not return control to the CEO. The machine routes the failure to the responsible stage, requires new evidence, and re-enters the failed gate. Repeated failures become candidates for permanent automation or adapter improvements.

## Live rule

`LIVE` is never inferred from a successful build. A release is LIVE only after deployment, public HTTPS, health, acceptance, promotion and required recovery evidence have passed.

## Infrastructure rule

IZAKHONO remains **owned-first and externally reversible**. External providers are adapters/fallbacks, not the authoritative production source.

## First production passengers

FAISReady and Allegro Vibez are the first applications intended to travel through this common machine. Once their manifests conform to the production contract and an owned runtime node is available, the same pathway carries both applications from source to verified production.
