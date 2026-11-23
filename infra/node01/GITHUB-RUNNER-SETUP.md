# NODE01 Runtime and Deployment Executor Boundary

NODE01 is a **logical IZAKHONO software-runtime identity**, not proof of a physical host, machine address, or authenticated execution session.

## Separation of concerns

- The HOST is the separately identified physical or virtual machine that may execute workloads.
- NODE01 is the logical runtime identity bound to an approved HOST through explicit, auditable configuration.
- A GitHub Actions runner is a separate execution capability. Its registration does not establish HOST ownership or NODE01 authorization.
- Do not assume that the production runtime itself should host an unrestricted CI runner.

## Registration gate

Do not register or activate a runner until all of the following are independently verified:

1. The HOST identity and ownership are documented and approved.
2. An authenticated operator session and least-privilege permissions are verified.
3. The approved HOST-to-NODE01 runtime binding is present and independently checked.
4. The runner execution boundary is approved, isolated from untrusted pull requests, and restricted to the intended repository and protected deployment environment.
5. The runner service account, filesystem access, container privileges, network egress, secret access, update policy, and audit retention are reviewed.
6. A human-approved change record authorizes registration.

Use a dedicated deployment executor where possible. Do not grant a general-purpose runner unrestricted root or Docker access on a production host without an explicit security decision.

## Labels and workflow policy

If and only if a deployment executor is approved and registered, use narrowly scoped labels that identify its approved environment. The label `node01` alone is not authorization and must never be treated as proof of runtime binding.

Do not use an arbitrary user-supplied SSH host, disable SSH host-key verification, or expose a runner listener publicly. Untrusted pull-request jobs must not share a privileged deployment runner.

## Current state

No HOST access, HOST-to-NODE01 binding, runner registration, or production execution is asserted by this document. The current owned-runtime workflow performs package validation only; remote deployment is intentionally disabled until the authorization and runtime gates pass.
