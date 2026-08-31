# IZAKHONO Launch Stack v1

IZAKHONO Launch Stack is the provider-neutral runtime layer that lets a Docker-capable Linux host publish multiple IZAKHONO applications without requiring Vercel, Netlify, Render or Supabase for the basic hosting path.

## What v1 owns

- HTTPS ingress and automatic certificates through self-hosted Caddy
- local Docker application runtime
- health-gated promotion from `.izakhono.json`
- one-command public commercial publication gate
- rollback to the previously retained container
- self-hosted PostgreSQL 17
- per-project database/user provisioning with host-only credentials
- localhost-only OCI/Docker registry for retained build images
- recovery of an exact retained release without source-control access
- portable Git bundle source snapshots
- local health checks
- PostgreSQL + control-plane + registry backup bundle
- isolated restore rehearsal without touching production data

## What remains external by nature or by deliberate choice

- a physical/virtual Linux machine and internet connection
- DNS registration/delegation
- certificate authority connectivity for public TLS issuance
- banking/payment rails such as PayFast
- optional transactional-email delivery until IZAKHONO operates a reputation-safe mail service
- an encrypted off-host backup destination for true disaster recovery

These are replaceable suppliers rather than application-platform dependencies.

## First-host sequence

On an Ubuntu/Debian machine checked out to this repository:

```bash
sudo bash scripts/launch-stack/bootstrap-host.sh --harden
sudo bash scripts/launch-stack/init-stack.sh
```

For an application that needs PostgreSQL:

```bash
sudo bash scripts/launch-stack/provision-project-db.sh my-project
```

Put any additional runtime-only environment variables in:

```text
/opt/izakhono/secrets/my-project.env
```

Mode must remain `0600`. Do not commit that file.

Point the chosen domain's DNS A/AAAA record at the host, then use the one-command publication wrapper:

```bash
sudo bash scripts/launch-stack/launch-project.sh /srv/izakhono/repos/my-project app.example.com --with-db
```

If no database is needed, omit `--with-db`. The wrapper requires the public HTTPS gate. Underneath it, the deployer reads the reviewed `.izakhono.json`, builds locally, records the image in the self-hosted registry, starts the candidate, requires its declared health path to pass, switches Caddy atomically, proves the public HTTPS health endpoint, and only then stops the previous release.

Rollback:

```bash
sudo bash scripts/launch-stack/rollback-app.sh my-project
```

## Source independence

Create portable Git bundles from every checked-out repository:

```bash
sudo bash scripts/launch-stack/snapshot-sources.sh /srv/izakhono/repos
```

A bundle can recreate the repository and branches/tags even if the original Git hosting service is unavailable. Keep copies off-host as well.

If source control is unavailable but the self-hosted registry and state backup survive, recover the exact current image without rebuilding:

```bash
sudo bash scripts/launch-stack/recover-current.sh my-project
```

## Backup and restore proof

```bash
sudo bash scripts/launch-stack/backup-stack.sh
sudo bash scripts/launch-stack/verify-backup-restore.sh /opt/izakhono/backups/<timestamp>
```

A same-host backup is not disaster recovery. Copy the resulting backup directory to encrypted off-host storage and periodically repeat the restore rehearsal from that off-host copy.

## Commercial publication rule

A successful local Docker build is not a commercial launch. For a project to be called publicly live through IZAKHONO Launch Stack, the HTTPS health endpoint must pass from outside the container network, required payment/legal/business gates for that product must separately be green, and no secret may be baked into a public frontend image.

## Revenue-first use

Use this stack first for products whose application-level commercial gates are already complete. Do not use infrastructure ownership as a reason to bypass payment verification, privacy, payroll, child-data, code-signing or other product-specific safety gates.
