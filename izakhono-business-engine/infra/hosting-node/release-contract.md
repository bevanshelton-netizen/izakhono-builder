# IZAKHONO Release Contract v1

The hosting node accepts only immutable, checksum-addressed release archives.

## Artifact

The `artifact_url` must use HTTPS unless `IZAKHONO_ALLOW_HTTP_ARTIFACTS=true` is explicitly configured for a controlled internal network.

The archive must be `.tar.gz`/gzip-compatible and contain a root `release.json` file. SHA-256 is mandatory.

Example manifest:

```json
{
  "contract": "izakhono.app.release.v1",
  "entrypoint": "server.mjs",
  "health_path": "/health",
  "install_dependencies": true
}
```

`entrypoint` must be a relative path within the extracted release. Arbitrary shell commands are not accepted. Dependency installation uses a fixed `npm ci --omit=dev --ignore-scripts` command when `package-lock.json` is present.

## Execution lifecycle

`accepted` → `running` → `published`, or `accepted` → `running` → `failed`.

A release is not marked `published` until:

1. The artifact downloads successfully.
2. The SHA-256 checksum matches.
3. The archive passes path-traversal validation.
4. The manifest contract is valid.
5. The release is staged atomically.
6. The application process starts.
7. The local health endpoint returns HTTP 2xx.
8. A configured public base URL exists.

The node exposes a status endpoint using the provider request ID and proxies `/releases/<provider-request-id>/...` to the verified local runtime.

## Security boundaries

- Maximum artifact size is configurable and defaults to 100 MiB.
- Maximum extracted file count is configurable and defaults to 5,000.
- Only HTTPS artifacts are accepted by default.
- No shell execution is used for release entrypoints.
- Release concurrency defaults to one.
- Release state is written atomically under `IZAKHONO_RELEASE_ROOT`.
- Secrets and release tokens are not included in release state responses.
