# THOR coding-worker security boundary

## Execution model

A task is an instruction to a constrained worker, not permission to execute arbitrary code on the control-plane host. The worker contract in `src/worker-contract.mjs` validates the repository, distinct work branch, explicit changed-path allow-list, approved test commands and resource ceilings before dispatch.

The contract is a policy validator, **not an operating-system sandbox**. A production worker must run in an ephemeral isolated container or VM with:

- no host filesystem mounts except its disposable checkout;
- no Docker socket, host process namespace, privileged mode or inherited environment;
- network disabled by default; any exception must use an explicit destination allow-list;
- a short-lived token scoped to one repository and one branch, with read access to the base branch and write access only to the task branch;
- CPU, memory, wall-clock, process-count and output-size limits;
- secret redaction in logs and no access to production, payment, DNS or customer credentials;
- changed-file validation against the task allow-list before a patch can be published.

## Release boundary

Workers may create a reviewable branch and pull request. They must not merge, promote, deploy, change DNS, provision paid resources, or modify production data. All such actions remain separate approval-gated workflows. Every result must include the commit SHA, changed-file list, test commands, exit codes and concise test output.

## Failure handling

A worker that loses its lease must stop and discard its workspace. A worker that exceeds a limit or touches a denied path must fail closed. Retries must use a fresh workspace and must not reuse untrusted generated artifacts.

## Current implementation status

The validation contract and unit tests are implemented. No production sandbox, repository-token broker, model adapter or continuously running coding worker is claimed by this change. Those components must be independently implemented and verified before THOR can accept live untrusted coding tasks.
