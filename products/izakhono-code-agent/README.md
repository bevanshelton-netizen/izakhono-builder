# IZAKHONO CODE

IZAKHONO CODE is a repository-aware, model-driven coding agent with persistent D1 sessions and an isolated NODE01 Docker execution runner.

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

Set `ALLOWED_REPOSITORIES` as an exact comma-separated Worker variable. The UI sends the owner key only in request headers and does not persist it in browser storage. The owner can explicitly approve lockfile-based dependency installation before tests.

## Worker setup

The Worker uses the existing IZAKHONO Builder D1 database. Apply the root migration before deploying:

```bash
npx wrangler@4.127.1 d1 migrations apply DB --remote
npx wrangler@4.127.1 deploy --config products/izakhono-code-agent/wrangler.jsonc
```

The standalone Worker config points its migration directory to the repository root migration set. Deploy only after the migration and all required secrets are configured.

## NODE01 runner installation

The runner requires Docker on the authorised owned host. Create a random token and install it at `/etc/izakhono/code-runner.owner-token` with root-only permissions. Build and start the Compose service from `products/izakhono-code-agent/runner`.

The service is published on host loopback only. On the verified, authorised NODE01 host, run `sudo bash products/izakhono-code-agent/runner/install.sh` from the repository root. Expose it to the Worker only through an authenticated TLS owner tunnel or private network. Do not publish port 8860 directly to the internet.

The runner mounts the Docker socket because it launches constrained per-command containers. It is a privileged host component and must only be installed by an authorised operator on a verified host.

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

The implementation is prepared for the owned-hosting architecture, but cannot be activated until the authorised NODE01 host session is available, the runner is installed and health-checked, owner secrets and a model endpoint are configured, the D1 migration is applied, and the Worker is deployed through the approved production control plane. No credentials are embedded in this repository.
