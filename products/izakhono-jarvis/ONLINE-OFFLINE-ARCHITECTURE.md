# J.A.R.V.I.S. Online + Offline Runtime Architecture

## Product requirement
J.A.R.V.I.S. must remain usable when internet access is unavailable, and must use online capabilities when connectivity and authorisation permit. Offline capability is a first-class operating mode, not a promise that cloud services remain reachable.

## Modes

### ONLINE
- Cloudflare-hosted J.A.R.V.I.S. API, remote D1-backed task/context/audit services, approved connectors, and approved remote model providers.
- Remote actions are available only through existing owner approval, scoped credentials, and the executor contract.
- Online status is based on successful authenticated API health checks, not merely navigator.onLine.

### OFFLINE
- Installable local-first web client (PWA) with a versioned app shell cached by a service worker.
- Encrypted local persistence for conversations, drafts, task records, attachments metadata, owner preferences, and an outbound sync journal.
- Local inference through the IZAKHONO Native Model Runtime (Ollama-compatible) on the same device or a trusted local Software NODE; no public model endpoint.
- Read-only local access to previously synchronised and explicitly permitted data. Clearly label data age and scope.
- Queue supported tasks locally with stable IDs and idempotency keys. Do not claim remote work has executed.
- Disable cloud-only connectors and irreversible actions while offline. Local actions must still obey owner auth and policy.

### TRANSITION / SYNC
- State machine: starting -> online | offline; online -> degraded | offline; degraded -> online | offline; offline -> syncing -> online | conflict | offline.
- Probe authenticated API and local model independently. Display separate connectivity, API, model, and sync states.
- Use an append-only local outbox; replay with idempotency keys and bounded exponential backoff after reconnection.
- Resolve conflicts by entity-specific version/ETag rules. Never silently overwrite owner decisions, approvals, audit events, or newer server state.
- Preserve local records on sync failure. Provide a reviewable conflict queue and explicit owner resolution where merge is ambiguous.
- Encrypt local sensitive records at rest; use per-owner/device key material protected by platform storage where available. Never persist bearer tokens in service-worker caches or plaintext browser storage.
- Sign or hash-chain local audit/outbox entries and verify integrity before sync. Server remains authoritative for cross-device audit.

## Hardware and model policy
- Baseline local model currently documented: qwen2.5-coder:3b via Ollama; it is a CPU-first baseline, not frontier-model parity.
- Check available memory, disk, CPU/GPU, model presence, and health before enabling local inference. Model download/bootstrap needs connectivity once; pre-provisioned weights are required for first-use offline operation.
- Make local model selection configurable by approved capability profile. Do not silently fall back to a remote provider in offline mode.
- If local model is unavailable, provide deterministic local functions, cached data, and queued tasks; label AI reasoning as unavailable rather than fabricating output.

## Security boundaries
- Owner-only administration; device registration and revocation; least-privilege local scopes.
- Offline mode cannot authorise payments, purchases, external messages, account changes, deployments, or other consequential remote side effects.
- Queue proposals, not privileged execution. Revalidate owner approval, permissions, current source state, and policy on the server after reconnection.
- Treat cached business data as sensitive: minimise fields, apply expiry/retention, support remote device revocation and local wipe on next connection.
- Do not expose Ollama on public ingress. For separate trusted nodes, use authenticated private overlay and explicit host allowlisting.
- Maintain auditable mode transitions, sync attempts, conflicts, device identity, and executor outcomes without logging secrets.

## Delivery sequence
1. Inventory current J.A.R.V.I.S. UI/API/auth routes, Worker asset delivery, D1 schema, local runtime adapter, and existing service-worker/PWA assets. Produce a compatibility map; do not replace existing product surfaces.
2. Add testable connectivity/mode state machine and capability policy.
3. Add installable app shell and offline navigation/read-only cached UI.
4. Add encrypted IndexedDB store, local outbox, idempotent sync and conflict review.
5. Integrate local model health/capability adapter and offline task execution limits.
6. Add device registration/revocation, local key lifecycle, retention and security review.
7. Run offline browser tests (cold start after install, airplane mode, restart, queue, reconnect, duplicate replay, conflict, revoked device, missing model), online regression tests, and end-to-end security tests.
8. Deploy only after CI, owner-auth, data migration, rollback, and authenticated production health gates pass.

## Acceptance criteria
- Previously installed client cold-starts and navigates offline with no network requests required for the cached app shell.
- Owner can create/read local conversation and task drafts offline; data survives reload and device restart.
- Offline task status is visibly queued/local-only and never reported as remotely completed.
- Local model inference works with network disconnected when model weights were provisioned beforehand; local model unavailable is reported accurately.
- Reconnection syncs each eligible operation exactly-once in effect (idempotent replay), retains failed records, and surfaces ambiguous conflicts.
- No cloud-only or irreversible action can execute offline.
- Revoked device credentials are rejected on next online contact; cached data has documented local retention/wipe behavior.
- Automated tests cover online, offline, degraded, sync, duplicate replay, conflict, tamper detection, auth failure, and storage quota failure.
- Production claim requires verified tests on target devices and a deployed authenticated health check.

## Current evidence and gaps
- Existing repo documents a local Ollama runtime at `products/izakhono-ai-runtime`, loopback-only endpoint, and qwen2.5-coder:3b baseline.
- Existing J.A.R.V.I.S. workforce is a bounded server-side supervisor; its executor is a separate HTTPS service contract.
- No evidence in this repository inspection establishes a J.A.R.V.I.S. PWA/service worker, encrypted local-first task store, offline sync engine, or deployed local executor. These must be built and tested; do not represent the feature as already live.
- The existing local model runtime documentation states initial model download requires internet. For true first-use offline setup, provision model weights in advance and verify hardware capacity.

## Non-goals / safeguards
- Offline mode does not imply full cloud parity, cross-device synchronisation without connectivity, or continuous remote workforce execution.
- Do not add background execution claims unless a real local process/worker is installed, running, monitored, and bounded.
- Do not deploy, migrate production databases, or alter credentials as part of this architecture-only change.
