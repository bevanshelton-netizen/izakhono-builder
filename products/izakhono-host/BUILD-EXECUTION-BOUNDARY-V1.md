# IZAKHONO HOST — Isolated Build Execution Boundary v1

**Project:** IZAKHONO HOST  
**Project ID:** IZK-HOST-001  
**Status:** Security architecture and implementation gate; not an active build service  
**Related integration:** Existing IZAKHONO Builder Alpha pipeline

## 1. Purpose

Introduce a dedicated build-execution trust boundary without expanding the privileges of the general compute worker or control plane. The current compute worker remains limited to `health-check`, `sha256` and `echo`. It must never execute arbitrary shell commands, Docker commands, build scripts or customer-supplied code.

The build plane will be a separately deployed, replaceable service. Its first implementation target is rootless BuildKit, with an authenticated broker and a narrow artifact handoff into the existing Builder Alpha validation pipeline.

## 2. Non-negotiable security invariants

1. **No Docker socket:** neither the general compute worker nor the build executor receives `/var/run/docker.sock` or a host container-runtime socket.
2. **No privileged container:** no `privileged: true`, host PID/network namespaces, host root mounts or broad host capabilities.
3. **Rootless execution:** BuildKit daemon and build processes run without host root. The selected rootless image and runtime configuration must be verified against the target kernel before activation.
4. **Separate identity:** build broker, build daemon, source fetcher and artifact publisher use distinct service identities and credentials.
5. **Private control path:** BuildKit's control socket is private to the broker/build service network. It is never published to the host or public network.
6. **Ephemeral workspace:** every build receives a unique temporary workspace and cache namespace. Workspace contents are destroyed after artifact and evidence capture, including on cancellation and failure.
7. **Bounded resources:** every build has hard CPU, memory, disk, process, concurrency and wall-clock ceilings. Defaults are conservative and owner-configurable.
8. **Restricted source:** builds may read only an explicitly authorized repository, immutable commit SHA and declared build context. No arbitrary URL, branch tip or untrusted submodule is accepted.
9. **Controlled egress:** build network access is denied by default. When dependency downloads are necessary, route through an auditable egress proxy with an explicit host allowlist. A Docker bridge alone is not an egress security control.
10. **No secret inheritance:** production secrets, deployment credentials, signing keys and control-plane credentials are never mounted into build steps or supplied as build arguments.
11. **Artifact-only handoff:** the build service returns an OCI artifact reference or archive, immutable digest, source commit, build metadata, SBOM and provenance. It cannot deploy or promote an artifact.
12. **Independent acceptance:** Builder Alpha revalidates the manifest, artifact digest, provenance, vulnerability policy and runtime health before any promotion.
13. **Auditable lifecycle:** enqueue, authorization, start, cancellation, timeout, completion, artifact publication and rejection events are recorded with correlation IDs.
14. **Fail closed:** missing policy, invalid signatures, expired authorization, unavailable evidence storage or exceeded resource limits cause rejection, not a permissive fallback.

## 3. Intended component boundaries

| Component | Responsibility | Must not do |
|---|---|---|
| HOST compute manager | Queue and track a build request by ID and policy reference | Execute build commands |
| Build authorization broker | Validate owner-approved project, source SHA, manifest and quotas; mint short-lived scoped job authorization | Accept arbitrary shell or arbitrary source URLs |
| Rootless BuildKit executor | Execute the declared build in an isolated ephemeral workspace | Access host Docker socket, deployment secrets or public control APIs |
| Egress proxy | Enforce dependency host allowlist and log outbound requests | Become a general-purpose open proxy |
| Artifact publisher | Store immutable OCI output and evidence under a content digest | Promote or deploy the output |
| Builder Alpha | Independently validate and test the returned artifact | Trust a worker's success flag without checking evidence |

The broker-to-executor protocol must be a versioned, typed job contract. The job contract must not contain a shell command field.

## 4. Build request contract

The initial request schema is intentionally narrow:

- `request_id`: unique idempotency key;
- `project_id`: registered IZAKHONO project identifier;
- `source_repository_id`: allowlisted repository identity, not a free-form URL;
- `source_commit_sha`: full immutable commit SHA;
- `manifest_digest`: digest of the validated build manifest;
- `build_profile`: an allowlisted profile such as `node-web-v1` or `static-site-v1`;
- `resource_class`: policy-selected CPU/memory/disk/time ceiling;
- `network_policy_id`: explicit egress policy, defaulting to no egress;
- `artifact_policy_id`: output format, retention and evidence requirements.

The executor derives the build invocation from a versioned, reviewed profile. It does not accept a caller-supplied Dockerfile path outside the checked-out context, command string, entrypoint override, mount list or runtime flags.

## 5. Rootless BuildKit deployment requirements

The proposed implementation uses the upstream `moby/buildkit:rootless` image only after its digest is pinned and its behavior is validated on the target host.

Required checks before activation:

- verify rootless user and user-namespace behavior inside the actual container;
- verify the selected snapshotter works on the target kernel and storage driver;
- explicitly review seccomp/AppArmor/system-path exceptions required by rootless BuildKit; document each exception and test that it does not grant host-root access;
- do not enable `--oci-worker-no-process-sandbox` as a shortcut;
- do not mount host root, host home, Docker/containerd sockets or broad host paths;
- keep the daemon socket on a private, permission-restricted volume shared only with the broker;
- enforce cgroup limits and per-build quotas at the executor boundary;
- ensure cancellation terminates the build process tree and removes the workspace;
- verify daemon restart does not expose stale workspaces or reuse an expired authorization.

A rootless image label alone is not proof of isolation. Kernel, user namespace, storage driver, daemon flags and mount configuration must all be tested together.

## 6. Artifact handoff to Builder Alpha

The handoff is a one-way, immutable contract:

1. Build broker receives a completed build and its evidence.
2. Artifact publisher stores the OCI artifact by digest in private storage.
3. Publisher returns a signed result envelope containing request ID, project ID, source commit SHA, manifest digest, OCI digest, SBOM reference, provenance reference, build profile and completion status.
4. Builder Alpha independently verifies envelope signature, artifact digest, source/manifest binding and policy evidence.
5. Builder Alpha imports the artifact into its existing validation flow, runs its own tests and health checks, and records a new acceptance decision.
6. Promotion/deployment remains a separate owner-authorized action.

A worker-reported `succeeded` status is not acceptance evidence. An artifact with missing or mismatched digest/provenance is rejected.

## 7. Required automated test matrix

| Test | Expected result |
|---|---|
| Executor container identity | Non-root UID; no host-root execution |
| Runtime mounts | No Docker socket, host root or undeclared host path |
| Container privileges | Not privileged; no host namespaces |
| Control socket | Not published; inaccessible from unrelated services |
| Job schema | Reject command, shell, arbitrary mount and arbitrary URL fields |
| Source binding | Reject mutable branch/tag and mismatched commit SHA |
| Authorization | Reject expired, replayed, wrong-project and wrong-profile tokens |
| Network | Deny by default; allow only explicitly approved proxy destinations |
| Resource limits | CPU, memory, disk, process and timeout limits enforced |
| Cancellation | Process tree stopped; workspace and temporary credentials removed |
| Secret isolation | Sentinel secrets unavailable inside build steps |
| Artifact integrity | Digest recomputed and matches signed result envelope |
| Provenance | Source commit and manifest digest cryptographically bound to output |
| SBOM | Generated and retained for every accepted build |
| Failure recovery | Daemon restart does not duplicate accepted artifacts or lose audit trail |
| Builder Alpha handoff | Alpha independently verifies and rejects tampered artifacts |

## 8. B0 audit — existing Builder Alpha (source inspection)

The existing `.github/workflows/izakhono-build-to-alpha.yml` is the authoritative current Alpha build-and-health workflow. Source inspection confirms:

- It validates a version-3 `.izakhono.json` manifest, confines manifest/build-context/Dockerfile paths to the repository, checks required metadata and infrastructure evidence labels, and validates the declared container port and health path.
- Its central preflight checks the build context for selected obvious credential patterns and rejects remote-URL `ADD` instructions in the Dockerfile.
- The `container-gate` currently invokes `docker build` on the GitHub Actions runner, tags the image with the application slug and a 12-character commit prefix, and applies product/commit/channel labels.
- The health gate invokes `docker run` on that runner, binds the test port to loopback, polls the declared health route, and removes the temporary container on exit.
- Optional database/application rehearsal and Windows packaging are separate jobs. A final result job blocks a passing Alpha result unless required gates pass.

**Integration implications:**

1. Preserve this manifest validation, preflight, rehearsal, packaging and health-gate behavior. Do not create a second Alpha pipeline.
2. The current workflow uses the runner's Docker CLI/daemon path; it does not yet call HOST's compute manager or a rootless BuildKit broker.
3. The current workflow does not publish a digest-addressed OCI artifact with a signed provenance/SBOM envelope for an external executor handoff. The build image is local to the ephemeral Actions runner.
4. Therefore the first integration must be an opt-in, non-production executor adapter that returns an immutable artifact and evidence to the existing Alpha gate. The Alpha gate must independently verify and load that artifact before running its existing health test.
5. Do not remove or bypass the current Docker-based path until the rootless path has passed equivalent tests and the owner approves a controlled migration.

This audit is source-level evidence only. It does not prove that a current workflow run succeeded or that the workflow has been changed to use HOST.

## 9. Rollout sequence

- **B0 — Existing pipeline audit:** identify Builder Alpha's current manifest validation, image build, runtime test and artifact interfaces. Preserve its existing acceptance logic; do not create a parallel Builder product.
- **B1 — Contract and policy:** define typed request/result schemas, authorization, idempotency, quotas and audit events.
- **B2 — Rootless executor prototype:** deploy only in a private test environment with pinned image digest and no public socket.
- **B3 — Adversarial validation:** run the complete test matrix, including escape attempts, resource exhaustion, egress denial and cancellation.
- **B4 — Artifact handoff:** integrate immutable OCI output and evidence into the existing Builder Alpha test path; no deployment authority.
- **B5 — Owner acceptance:** demonstrate reproducible builds, verified artifacts, cleanup, recovery and cost ceilings before enabling real project builds.

## 10. Current status and explicit exclusions

This document defines the required boundary. It does **not** claim that BuildKit is deployed, that a sandbox has passed escape testing, that artifacts are being handed to Builder Alpha, or that customer code can currently be built by HOST.

No build executor, privileged runtime, public endpoint, paid infrastructure or deployment permission is activated by this change. The next implementation change must begin with an audit of the actual Builder Alpha source and a testable typed contract, followed by the isolated executor. Do not connect the executor to production projects until B3 passes.

## 11. Definition of done

The build boundary is accepted only when all B0–B5 gates have machine-readable evidence, the executor runs rootless under enforced resource limits, no host container socket is present, egress is controlled, cleanup is verified after success/failure/cancellation, artifacts are digest- and provenance-verified by Builder Alpha, and owner-approved cost ceilings are enforced.
