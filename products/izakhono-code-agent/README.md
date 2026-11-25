# IZAKHONO CODE

IZAKHONO CODE is a repository-aware, model-driven coding agent with persistent D1 sessions and an isolated workspace execution runner. The runner is a separately managed execution component; it is not NODE01 itself.

## Runtime architecture

The intended owned-runtime path is:

`IZAKHONO CODE → IZAKHONO BUILDER → IZAKHONO Runtime/App Fabric → EDGE/TLS`

NODE01 is a logical IZAKHONO software-runtime identity, not a machine, VM, container host or other physical infrastructure. The execution host is a separately managed, replaceable infrastructure resource. A runtime-binding record must bind the NODE01 software identity to an independently identified execution host and must state `runtime_host_is_separate: true`.

The workspace runner described below is an execution component deployed on an approved execution host and registered through the authorised runtime control plane. Do not label the host itself NODE01 or infer a valid NODE01 binding merely because the runner is installed or reachable.

## Components

- `src/worker.ts`: authenticated API, D1 session/message/event persistence, GitHub archive checkout, OpenAI-compatible model adapter, bounded agent loop, runner bridge and explicit pull-request publishing.
- `src/index.ts`: shared coding-agent contracts and path/command policy.
- `runner/server.mjs`: owner-token-protected workspace service; validation commands run in network-disabled Docker containers with memory, CPU, PID, filesystem and capability limits. Dependency installation is a separate owner-approved action that accepts only lockfile URLs from registry.npmjs.org and disables lifecycle scripts.
- `public/index.html`: browser workspace for creating tasks, chatting with the agent, browsing workspace files, viewing source, reviewing diffs, installing locked dependencies and opening pull requests.
- `migrations/0003_code_agent.sql`: persistent sessions, messages and events.

## Configure Worker secrets

Set these using Wrangler secrets; never commit them:

- `CODE_AGENT_SECRET`: owner API/UI access key.
- `MODEL_URL`: HTTPS OpenAI-compatible base URL ending before `/chat/completions`.
- `MODEL_NAME`: model identifier (e.g. an owner-approved Qwen Coder deployment).
- `MODEL_PROTOCOL`: `ollama-chat` for native Ollama `/api/chat`, or `openai-chat-completions` for OpenAI-compatible `/chat/completions` (default).
- `MODEL_API_KEY`: optional model credential.
- `GITHUB_TOKEN`: fine-grained token with read/write access to allowlisted repositories and pull requests.
- `WORKSPACE_RUNNER_URL`: HTTPS URL for the authorised runner.
- `WORKSPACE_RUNNER_TOKEN`: runner bearer token.

The standalone Worker config defaults `ALLOWED_REPOSITORIES` to `bevanshelton-netizen/izakhono-builder` and `MODEL_PROTOCOL` to `openai-chat-completions`; extend the exact repository allowlist only as needed. Use `ollama-chat` for native Ollama. The UI sends the owner key only in request headers and does not persist it in browser storage. The owner can explicitly approve lockfile-based dependency installation before tests.

## Worker setup

The Worker uses the existing IZAKHONO Builder D1 database. Apply the root migration before deploying:

```bash
npx wrangler@4.127.1 d1 migrations apply DB --remote
npx wrangler@4.127.1 deploy --config products/izakhono-code-agent/wrangler.jsonc
```

The standalone Worker config points its migration directory to the repository root migration set. Deploy only after the migration and all required secrets are configured through the approved production control plane.

## Workspace runner installation

The runner requires Docker on an approved execution host that has been independently authorised and bound to the IZAKHONO Runtime/App Fabric. Create a random token and install it at `/etc/izakhono/code-runner.owner-token` with root-only permissions. Build and start the Compose service from `products/izakhono-code-agent/runner`.

The service is published on execution-host loopback only. Install it only after verifying the execution host locator, runtime-binding record, host ownership/authorisation and approved deployment procedure. Expose it to the Worker only through an authenticated TLS owner tunnel or private network. Do not publish port 8860 directly to the internet.

The runner mounts the Docker socket because it launches constrained per-command containers. It is a privileged host component and must only be installed by an authorised operator on the verified, approved execution host. Installing the runner does not create, rename or activate NODE01; the NODE01 software identity remains separate.

## Execution controls

- Exact repository allowlist; GitHub archive checkout capped at 20 MB.
- Workspace paths reject absolute paths and traversal; archive links and special files are rejected.
- Common secret files are stripped from the workspace; likely credentials are redacted from file reads and command output. Secret-bearing changed files cannot be published.
- Dependency installation requires an explicit owner action, a modern package lock, registry.npmjs.org-only package URLs and disabled lifecycle scripts.
- Commands are argv arrays, never shell strings; executable and dangerous interpreter flags are restricted.
- Validation containers have no network, read-only root, bounded memory/CPU/PIDs, dropped capabilities and no-new-privileges.
- The agent can create a reviewable GitHub pull request only through an explicit owner action in the UI. It cannot merge or deploy.
- No production deployment, DNS mutation, merge, host bootstrap or automatic publication is exposed by the agent API.

## Validation

```bash
npm run code-agent:test
npm run code-agent:typecheck
node --check products/izakhono-code-agent/runner/server.mjs
docker compose -f products/izakhono-code-agent/runner/docker-compose.yml config
```

## Activation prerequisites

The implementation is prepared for the owned-runtime architecture, but cannot be activated until all of the following are verified:

1. An approved execution host is registered and reachable through the authorised runtime control plane.
2. The NODE01 software-runtime identity is bound to that host through the authoritative runtime-binding record, with `runtime_host_is_separate: true` and a real infrastructure locator.
3. The workspace runner is installed on that approved host, registered with the runtime and health-checked over its private authenticated route.
4. Owner secrets and an approved model endpoint are configured securely.
5. The D1 migration is applied and the Worker is deployed through the approved production control plane.
6. Runtime, security, health and acceptance evidence is independently verified before any LIVE or production-ready status is declared.

No credentials are embedded in this repository. A successful repository build, CI run, runner installation or container health check alone does not prove that NODE01 is bound, accepted or LIVE.
