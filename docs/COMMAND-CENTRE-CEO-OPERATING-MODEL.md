# IZAKHONO COMMAND CENTRE — CEO operating model

## Objective

Turn IZAKHONO COMMANDS into the owner control surface for the infrastructure that already exists. Do not build a parallel deployment engine.

## Production control path

```text
Owner
  |
IZAKHONO COMMANDS :8091
  |
IZAKHONO CONTROL :9292
  |
HMAC signed job
  |
IZAKHONO NODE :9191
  |
IZAKHONO CODE / Docker / health gate / rollback / signed evidence
  |
IZAKHONO RUNTIME + EDGE
```

External infrastructure remains a reversible resilience path. It is not the authority for owner deployment actions.

## Immediate commands

- `/infra` — owned service health from NODE01.
- `/node` — NODE identity and capabilities through CONTROL.
- `/deploy-status` — recent deployment jobs.
- `/job <job-id>` — inspect one job.
- `/deploy izakhono-commands <40-character-sha>` — submit the reviewed Command Centre profile to CONTROL → NODE.

Production deploys require immutable commit SHAs. Arbitrary compose files, shell commands and repository URLs are not accepted from the browser.

## Source of truth

IZAKHONO CODE stores repositories under:

`/var/lib/izakhono-code/repos/*.git`

CONTROL and NODE use that same canonical path. GitHub is a bootstrap/mirror source only.

## Activation

On the owner Windows machine, run:

`ACTIVATE-IZAKHONO-COMMAND-CENTRE.cmd`

It activates NODE + CONTROL, syncs this repository into IZAKHONO CODE, installs the gateway and proves local health.

## Public gate

Do not call the Command Centre publicly live until the owned EDGE/TLS route is independently verified. Local CONTROL/NODE readiness and public HTTPS readiness are separate states.
