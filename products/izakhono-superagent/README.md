# IZAKHONO SUPERAGENT Runtime

The runtime turns the SuperAgent v1 orchestration core into an HTTP service.

## Endpoints

- `GET /health` — liveness check.
- `POST /v1/plan` — convert one owner objective into an execution graph.
- `POST /v1/run` — execute a planned graph until `complete` or a genuine `blocked` gate.
- `POST /v1/fetch` — retrieve HTTPS content only from an explicit host allowlist.

All operational endpoints require `x-superagent-secret`.

## Tool adapters

The runtime currently wires:

- `web_research` -> configurable `SEARCH_URL` adapter
- `code` / `build` -> configurable IZAKHONO Builder `/api/build-anything` adapter
- `artifact` -> validated artifact manifest generation

File, repository, database, messaging and deployment operations remain explicit adapter boundaries. They are intentionally not implemented as arbitrary filesystem, shell or network access.

## Required secrets/variables

- `SUPERAGENT_SECRET` — secret protecting the runtime API.
- `BUILDER_URL` — approved IZAKHONO Builder base URL.
- `BUILDER_SECRET` — Builder admin secret when required.
- `SEARCH_URL` — approved search/research service endpoint.
- `ALLOWED_FETCH_HOSTS` — comma-separated HTTPS host allowlist for direct fetch.

Secrets must be configured in the deployment environment and never committed to Git.

## Execution model

`GOAL -> PLAN -> RESEARCH -> EXECUTE -> VERIFY -> RECOVER -> ARTIFACT -> RELEASE GATE`

The runtime inherits the core authorization gates. It does not bypass payment, legal, account-permission, irreversible-action or public-release gates.
