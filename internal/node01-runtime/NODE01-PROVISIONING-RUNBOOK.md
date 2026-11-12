# IZAKHONO NODE01 Software — Execution Environment Provisioning Runbook

## Identity boundary

**NODE01 IS SOFTWARE. THE MACHINE IS REPLACEABLE.**

The former execution machine has been replaced. This runbook provisions or rebinds a separate execution environment for the existing NODE01 software identity. It does not create or install a new NODE01 identity.

## Phase 1 — Bind the replacement environment

1. Identify the actual replacement environment through its verified provider/asset locator.
2. Confirm that the former environment is no longer the active binding.
3. Record `logical_node_id: NODE01` and `identity_type: software-runtime`.
4. Record the replacement locator in `runtime_host`; it must not equal NODE01.
5. Set `runtime_host_is_separate: true`.
6. Keep execution disabled while the locator or ownership is unverified.

Do not guess a hostname, IP address, provider, OS or machine identifier. Do not copy an old machine locator into the new binding.

## Phase 2 — Prepare the execution environment

Apply only the controls relevant to the selected substrate: supported OS/runtime, security updates, least-privilege access, network policy, encrypted secrets, monitoring and recovery access. Hardware diagnostics, UPS and physical assembly checks apply to physical equipment only; they are not NODE01 identity checks.

## Phase 3 — Restore NODE01 software runtime

1. Obtain the approved immutable NODE01 software release.
2. Verify its source and artifact digest.
3. Install or start the software using the selected environment's supported runtime mechanism.
4. Restore approved configuration and state from verified backups.
5. Keep administrative tokens and private keys outside source control.
6. Confirm the software reports logical identity NODE01 and reports the separate execution-environment locator independently.

## Phase 4 — Validate services and recovery

1. Verify runtime health and release identity.
2. Verify application workloads and dependencies.
3. Verify backups and perform a restore rehearsal.
4. Verify edge routing, DNS and TLS independently where applicable.
5. Test rollback and post-rollback health.
6. Record timestamped acceptance evidence.

## Phase 5 — Promote

Only after the replacement binding and all required acceptance evidence pass may the deployment be promoted. A successful repository CI run, an installed service or a configured binding alone is not production acceptance.

## Replacement continuity

NODE01 remains the same software identity across machine replacement, migration, scaling, restart and provider changes. Only the separate runtime binding changes.
