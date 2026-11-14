# Read-only Build Worker

The registry's bounded build worker verifies GitHub Actions check runs for an exact commit. It does not execute arbitrary shell commands, write repository files, create releases, or deploy.

## Runtime configuration

Configure these Worker secrets/variables before enabling the scheduled build worker:

- Secret `GITHUB_TOKEN`: a fine-grained GitHub token with read-only access to Actions checks and metadata for the permitted repositories.
- Variable `BUILD_ALLOWED_REPOSITORIES`: comma-separated `owner/repository` allowlist, for example `bevanshelton-netizen/izakhono-builder`.

Do not put the token in `wrangler.jsonc`, source code, D1, job input, or logs. The worker remains inactive for build execution when either setting is absent.

## Job input contract

A build-worker job must carry an object with:

```json
{
  "repository": "bevanshelton-netizen/izakhono-builder",
  "revision": "full-or-abbreviated-commit-sha",
  "checks": ["typecheck", "unit-tests", "manifest"]
}
```

Supported check groups map to required completed-success GitHub check runs. Every required check must exist on the exact requested commit and have conclusion `success`. Missing, pending, cancelled, timed-out, neutral, skipped, or failed checks are not verification success.

The default mapping is intentionally explicit in `registry/github-build-verifier.ts`. Adjust it only when the corresponding CI workflow names change, and update the mocked contract tests at the same time.

## Security boundaries

- The repository must be in the configured allowlist.
- Only GET requests to the GitHub check-runs API are made.
- The commit SHA is bound into the API request.
- The worker cannot choose arbitrary check-run names from job input.
- Verification evidence records the check group, result, and detail.
- Production deployment and other high-impact operations remain separate and human-gated.

A successful verifier result proves that the required GitHub checks passed for the requested commit. It does not itself rebuild, modify, publish, or deploy source code.
