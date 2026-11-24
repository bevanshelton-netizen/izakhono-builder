# NODE01 Access, Runtime Binding and Activation Gate

## Status

This document records the repository-side gate for activating the IZAKHONO-owned runtime. It does not assert that a physical host is available, that a runner is registered, or that deployment has occurred.

**No activation, bootstrap, DNS mutation or production promotion is authorised by this document.**

## Current repository facts

- `NODE01-ACTIVATE.sh` exists and invokes `NODE-PREFLIGHT.sh`, then `bootstrap-owned.sh`, then `NODE-COMPLIANCE.sh`, and finally checks the local health endpoint.
- `bootstrap-owned.sh` can create a local `.env` containing generated secrets, validate and build the Compose runtime, start services, and wait for health.
- `NODE-ENVIRONMENT-ACTIVATE.sh` now exists with read-only preflight, signed-approval verification and owner-gated activation modes. It verifies a detached signature, NODE01/software identity, separate environment locator, local hostname, exact source revision, runner attestation, approval expiry, change reference and rollback/backup references. Activation additionally requires root, an active systemd runner service, a read-only preflight and typed operator confirmation.
- The procedure does not create the owner key, sign an approval, register the runner or discover the physical host. Those remain owner-controlled handoff steps. No production host operation has been run.
- No root-level runtime-binding manifest or dedicated runner-registration script was found in the inspected `products/izakhono-host` tree.

The missing activation wrapper has been built, but the signed owner approval and actual host/runner binding remain external prerequisites.

## Required access handoff

Before any host-side operation, the authorised infrastructure owner must provide and verify:

1. The approved execution-environment locator (for example, the approved host name or management endpoint), recorded separately from the logical NODE01 software identity.
2. An authenticated, least-privilege deployment interface to that environment.
3. The approved runner registration mechanism and evidence that the runner is registered to the intended environment.
4. The authorised operator identity, permitted execution scope, and change/maintenance approval.
5. A secure method for supplying runtime secrets directly on the host. Secrets must never be committed to this repository or pasted into pull requests, issues, or logs.

Credentials, private keys, tokens and secret values must not be requested in this document or stored in Git.

## Pre-activation checks

After access is established, first perform read-only identity and capability checks using the approved management interface. Confirm the actual environment locator, operating system, architecture, available storage, Docker Engine/Compose availability, network reachability and execution permissions.

Then review the exact contents and side effects of every proposed command. The current `NODE01-ACTIVATE.sh` is **not** a read-only preflight: it proceeds into `bootstrap-owned.sh`, which can generate secrets, build images and start services. Do not run it as an access test or discovery command.

A repository-side candidate is now provided at `NODE01-READONLY-PREFLIGHT.sh`. It inventories local identity, OS, compute/storage and local container-client/version availability. It deliberately does **not** contact the Docker daemon, because a configured remote Docker context or `DOCKER_HOST` could turn a seemingly read-only daemon query into a network connection. Daemon connectivity, network reachability and remote capability checks remain separate, explicitly authorised steps. The script performs no network probes, writes, builds, starts, secret generation or configuration changes. Review the exact script and obtain the infrastructure owner's approval before running it on any host. Its output is discovery evidence only, not authorisation or production acceptance. Do not improvise additional commands on the production host.

## Runtime binding evidence

Before deployment is considered, create a reviewed runtime-binding record containing, at minimum:

- logical software identity: `NODE01`;
- identity type: `software-runtime`;
- actual execution-environment locator (not a placeholder);
- `runtime_host_is_separate: true`;
- runner identity and registration/health evidence;
- deployment revision and timestamp;
- approving operator/change reference.

Do not publish sensitive infrastructure details beyond the access-controlled operational record. The binding must not equate the software identity NODE01 with a particular replaceable machine.

## Activation and production acceptance

Activation may be considered only after access, runner registration, change approval, secret handling and command review are verified. The activation sequence must be explicitly approved for the identified environment.

Production promotion remains blocked until current evidence independently demonstrates:

- runtime and service health;
- security controls, least privilege and tenant isolation;
- persistent storage and successful backup/restore;
- rollback readiness and a tested rollback procedure;
- public IPv4/IPv6 reachability as applicable, DNS delegation/resolution and TCP 80/443 reachability;
- trusted HTTPS and correct customer-hostname content.

DNS cutover and customer LIVE status require separate explicit approval after all applicable acceptance evidence passes. Repository contents, CI results, a runner record, or a local health check alone do not prove public production readiness.

## Stop conditions

Stop without making changes if the execution-environment locator is missing or placeholder, authentication is not verified, runner registration cannot be proven, the command's side effects are unclear, secrets cannot be supplied securely, or rollback is not established.

Vercel remains an optional fallback and is not the owned production runtime of record.
