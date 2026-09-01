# IZAKHONO Repository Autopilot v1

Repository Autopilot turns a validated IZAKHONO-generated application into a repository-ready package and, when the Builder runtime has a server-side GitHub automation credential, can create and populate a new private repository.

## Generated package

Every new generated application now includes:

- application Worker source and static landing page
- `package.json` and `wrangler.jsonc`
- `.github/workflows/izakhono-generated-ci.yml`
- `.github/workflows/izakhono-isolated-preview.yml`
- `.izakhono.repository.json`
- `.gitignore`
- a distinct 12-character technical-preview revision

The Builder's own technical preview is versioned as `/preview/<slug>/<revision>/`. A stale revision does not resolve as the current generated version.

## Repository publication safety

Publication is owner-only and requires a generated bundle that already passed deterministic validation.

The publisher:

1. defaults to a **private** repository;
2. checks whether the target repository already exists and refuses to overwrite it;
3. validates the configured GitHub owner before user-account creation;
4. creates Git blobs, one tree and one generated-source commit before moving the default branch ref;
5. never writes the GitHub automation credential into generated source, D1 project content or browser output.

Runtime configuration is server-side only:

- `GITHUB_AUTOMATION_TOKEN` — token with the minimum permissions needed to create the target repository and write its contents/workflows
- `GITHUB_OWNER` — target GitHub user or organization
- `GITHUB_OWNER_KIND` — optional `user` or `org` (`user` by default)

Do not put these values in `wrangler.jsonc`, generated files or public source.

## Generated CI

The generated CI workflow uses read-only repository permissions and runs `npm run validate` on pushes, pull requests and manual dispatches.

## Isolated provider preview

The generated preview workflow validates the application first and can deploy a separate Cloudflare Worker name per pull request. It intentionally uses `pull_request`, never `pull_request_target`.

Provider deployment remains credential-gated. The generated repository must receive these repository secrets before provider preview deployment can occur:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

If the secrets are absent, validation still runs and the workflow records that provider preview is blocked. It does not invent a successful deployment.

## Readiness boundary

Repository publication and preview automation prove source packaging and deployment mechanics. They do not prove commercial readiness, payment compliance, data protection approval, production persistence, disaster recovery, customer acceptance or external security review.
