# IZAKHONO Fast Build v0.2

IZAKHONO Fast Build v0.2 turns the successful SHELTON FORTRESS Alpha build pattern into a reusable repository contract.

## Goal

A normal Docker-capable application should need only:

1. `.izakhono.json`
2. a Dockerfile and HTTP health endpoint
3. the tiny caller workflow from `templates/call-izakhono-alpha.yml`

The shared IZAKHONO workflow then validates repository-relative paths, builds the real container, labels it with product and Git provenance, starts it, and requires the declared health endpoint to pass.

## Optional project-specific gates

Projects that need deeper Alpha proof can enable two reviewed extensions in `.izakhono.json`:

```json
{
  "alpha": {
    "rehearsal": true,
    "windows_package": true
  }
}
```

`rehearsal: true` requires the exact checked-in file `scripts/izakhono/alpha-rehearsal.sh`.

`windows_package: true` requires the exact checked-in file `scripts/izakhono/package-alpha.ps1`, and that script must create one or more files under `dist/izakhono-alpha/`.

These are fixed repository paths. The Owner interface does not accept arbitrary shell commands or arbitrary script paths.

## Promotion rule

A build is Alpha-valid only when the required contract and container health gate succeed, and every enabled optional gate succeeds. Failed or cancelled required gates produce one clear `ALPHA BUILD: FAIL` result. Nothing should be promoted from a failed build.

Artifact upload is only a convenience layer. A quota failure may prevent download retention, but it must not be confused with successful software validation. The job summary remains the source of truth for the build result.

## What this does not prove

CI Alpha validation does not prove public DNS/TLS, persistent production hosting, off-host disaster recovery, physical-device behaviour, external security review, legal/privacy approval, legitimate publisher code signing, or customer acceptance. Those remain explicit external gates.

## Free-first principle

The workflow itself is provider-neutral for Docker builds and does not require Supabase, Vercel, Netlify or another application platform. GitHub-hosted runner use is subject to the repository/account's GitHub Actions allowance; real public hosting still requires compute somewhere.
