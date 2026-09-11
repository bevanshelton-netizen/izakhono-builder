# IZAKHONO RUNNER

Owner-controlled executor for IZAKHONO TASKS.

## v1.0 capabilities

- Website change watch
- JSON/API change watch
- Generic HTTP change watch
- Public GitHub repository watch
- persistent content fingerprints
- condition-watch notifications only when a change occurs
- HMAC-authenticated TASKS -> RUNNER calls
- SSRF protection: localhost/private network targets are blocked by default
- entity-scoped watch state

## Architecture

IZAKHONO TASKS -> signed request -> IZAKHONO RUNNER -> approved connector -> result

The runner returns `notify: false` when a condition watch has not changed.

## Current boundary

v1 deliberately does **not** pretend to have Gmail, banking or arbitrary account access.

Those require provider-specific authentication and should be added as explicit connector modules with secrets stored in IZAKHONO VAULT.

## Task runner specification

The task payload may include:

```json
{
  "runner_spec": {
    "type": "website_watch",
    "url": "https://example.com/status"
  }
}
```

Supported types:

- `website_watch`
- `json_watch`
- `http_watch`
- `github_public_watch`

GitHub example:

```json
{
  "type": "github_public_watch",
  "repo": "bevanshelton-netizen/izakhono-builder",
  "endpoint": "pulls"
}
```

## Security

`IZAKHONO_RUNNER_SECRET` is mandatory.

TASKS signs each request as:

`HMAC_SHA256(secret, timestamp + "." + raw_body)`

Private network targets are blocked unless `IZAKHONO_RUNNER_ALLOW_PRIVATE=true` is explicitly set.

## Next connectors

1. Gmail via user-authorized OAuth
2. IZAKHONO MAIL
3. GitHub authenticated actions
4. payment and deployment status connectors
5. owner AI summarization through IZAKHONO AI GATEWAY
