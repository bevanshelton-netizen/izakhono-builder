# IZAKHONO NODE Independence v1

## Objective

NODE01 must never again be a mandatory single point of execution. The portfolio must be able to continue from another healthy IZAKHONO node or an approved external bridge without changing the authoritative product source.

## New control model

```text
                 IZAKHONO CODE / FORGE
                         |
                 immutable release
                         |
                NODE INDEPENDENCE
                    GUARDIAN
                         |
          +--------------+--------------+
          |              |              |
       NODE01          NODE02         NODE03        NODE04
       primary        recovery       recovery      recovery
          |              |              |              |
          +--------------+--------------+--------------+
                         |
                    FORTRESS / EDGE
                         |
                   IZAKHONO DNS
                         |
                 public application
                         |
             external fallback bridge
```

## Hard rules

1. **No single-node dependency.** A product release is not considered resilient if only NODE01 can execute it.
2. **Source is independent of runtime.** Forge/IZAKHONO internal repositories remain authoritative; nodes are replaceable execution capacity.
3. **Health before promotion.** A node cannot receive production traffic until its health contract passes.
4. **Automatic selection.** The guardian ranks healthy nodes by configured priority and selects the best available node. If NODE01 fails, it is skipped without waiting for manual approval.
5. **External continuity.** If all owned nodes fail, the last verified external route remains the production bridge.
6. **Data safety.** Customer-data promotion requires a successful backup and isolated restore proof. Runtime failover must not silently migrate databases.
7. **Public safety.** DNS/EDGE changes require public HTTPS verification. The guardian only produces a decision; authenticated infrastructure adapters perform the actual routing change.
8. **No false live status.** A route is only labelled `OWNED LIVE VERIFIED` after the existing portfolio cutover gates pass.
9. **Recovery is tested, not theoretical.** At least one non-primary node must be periodically promoted in a controlled rehearsal.
10. **No secrets in source.** Node credentials, provider tokens and customer data stay outside the repository.

## What this fixes

The previous model made NODE01 the primary authority and left NODE02–NODE04 as planned recovery capacity. The new model separates **authority** from **runtime**. NODE01 can fail, be offline, be replaced, or be rebuilt without making the source of truth or the deployment pipeline unavailable.

## Required node contract

Every node must expose:

- `/healthz` — process/dependency health;
- a version/build identifier;
- a node identity;
- a readiness state;
- a bounded deployment endpoint reachable only through the trusted control plane;
- backup/restore hooks appropriate to the workload.

## Promotion sequence

```text
release approved
  -> immutable source revision
  -> probe NODE01..NODE04
  -> select healthy node
  -> deploy candidate
  -> health + smoke test
  -> backup/restore gate where data is involved
  -> EDGE promotion
  -> public HTTPS verification
  -> record evidence
```

If the selected node fails, the deployment is retried on the next healthy node. If no owned node is healthy, the external production bridge remains active and the release is not falsely promoted.

## Physical rollout still required

This repository change creates the control-plane contract and guardian, but it does **not** manufacture physical machines or network connectivity. NODE02–NODE04 must be provisioned from the same reproducible node image/package and must pass the real-machine verification gates before being promoted to production capacity.

The first practical rollout is therefore:

1. keep current NODE01 intact;
2. provision NODE02 from the same immutable sovereign package;
3. prove health, backup, restore and rollback;
4. run a controlled NODE02 promotion rehearsal;
5. provision NODE03;
6. provision NODE04;
7. enable scheduled resilience drills;
8. only then retire NODE01 as a single point of failure.

## Success condition

**NODE01 can disappear and the platform can still be built, recovered and served from another verified path without changing the authoritative source or inventing a new manual emergency procedure.**
