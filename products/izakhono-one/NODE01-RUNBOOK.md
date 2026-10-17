# IZAKHONO ONE — OWNED NODE / CONTROL RUNBOOK

## Purpose

Prove the IZAKHONO ONE runtime on the **owner-controlled node fabric** before any public DNS, EDGE, or TLS change.

The authoritative architecture is:

`IZAKHONO CONTROL -> IZAKHONO NODE -> IZAKHONO ONE`

The older `NODE01.cmd` launchers are retained as bootstrap/operator compatibility tools. They are not the production authority and are not, by themselves, evidence of an owned production node.

## Authoritative activation order

### 1. IZAKHONO CONTROL

CONTROL must identify the target node, confirm that it is registered and authorized, and establish the desired IZAKHONO ONE revision.

Required evidence:

- node ID is known;
- node is `REGISTERED` and `READY`;
- node capabilities satisfy the workload;
- security posture is acceptable;
- deployment intent has an audit correlation ID.

### 2. IZAKHONO NODE

The authorized node receives the approved workload revision and starts IZAKHONO ONE using the portable container/runtime contract.

Required evidence:

- node health is healthy;
- IZAKHONO ONE `/health` is healthy;
- deployment revision matches the CONTROL intent;
- Builder/FLOW owned integrations report their expected internal state;
- no required third-party production host is in the execution path.

### 3. PUBLIC EDGE / TLS

Only after the owner-node deployment is independently verified may public EDGE/TLS routing be promoted.

Required evidence:

- public HTTPS 200;
- verified user experience;
- route terminates on the authorized owned production path;
- rollback path remains available.

## Compatibility bootstrap

If an operator needs to bootstrap or diagnose a node manually, the existing repository-root scripts may still be used:

- `START-APP-FABRIC-NODE01.cmd`
- `RUN-IZAKHONO-ONE-NODE01.cmd`

These scripts are **not** the production architecture. Do not interpret their local Windows/Docker output as proof of an owner-controlled node fleet.

## Verification endpoints

On an authorized node, verify:

- `/health`
- `/api/builder`
- `/api/flow`
- `/api/flow/health`

The exact node address is supplied by CONTROL; do not hard-code a workstation loopback address into the production contract.

## Failure handling

If CONTROL, node health, deployment verification, or security posture fails:

1. stop promotion;
2. preserve the evidence;
3. keep public routing unchanged;
4. do not expose secrets;
5. do not claim `OWNED LIVE`;
6. allow CONTROL to drain/fail over to another authorized healthy node where capacity exists.

## Promotion gate

`SOURCE VERIFIED -> CONTROL READY -> NODE READY -> DEPLOYMENT VERIFIED -> PUBLIC EDGE/TLS VERIFIED -> OWNED LIVE`

A GitHub commit, CI pass, Supabase dashboard, or local workstation run cannot substitute for real owner-node validation.
