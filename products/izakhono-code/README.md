# IZAKHONO CODE — Complete Alpha

Owner-controlled, local-first developer platform integrated into IZAKHONO CLOUD.

## Alpha capabilities

- bare Git repository creation and local clone URLs
- repository file viewing and browser-originated commits
- issues and pull-request records
- reviewed-command CI runner (no arbitrary command execution)
- release and package metadata
- local persistent storage with serialized atomic updates
- owner-token protection and loopback-only default binding
- Windows owner-laptop launcher

## Start on the dedicated Windows laptop

Install Node.js 20+ and Git for Windows, then double-click:

`START-IZAKHONO-CODE.cmd`

The launcher keeps the window open when a prerequisite or startup check fails and writes a diagnostic log to `C:\ProgramData\Izakhono\Code\startup-diagnostic.log`.

Advanced PowerShell launch:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\START-IZAKHONO-CODE.ps1
```

Open `http://127.0.0.1:4177`. The owner token is generated locally under ProgramData and is never committed.

## Replaceable coding-agent evaluation

IZAKHONO CODE now includes a guarded DeepSeek Harness evaluation lane:

- `START-DEEPSEEK-HARNESS-SANDBOX.cmd`
- `DEEPSEEK-HARNESS-SANDBOX.md`

The launcher uses a dedicated non-production workspace and dedicated `DSH_HOME`. Harness remains developer-preview software and is not part of the trusted production boundary. It must never be given production secrets, customer records, FORTRESS intelligence or irreplaceable source.

## AI Operations console

The owner dashboard now reports read-only operational readiness for:

- the local IZAKHONO SUPER AI health endpoint;
- whether an external development adapter is enabled;
- the DeepSeek Harness isolated sandbox package;
- the Oracle A1 auxiliary-worker bootstrap package.

The browser does **not** launch Harness or execute an AI agent. Harness remains a manual local sandbox so a compromised browser session cannot silently start a command-executing coding agent.

## Readiness boundary

Complete Alpha means the product surface is present for controlled owner testing. It is not commercial GA. Server migration, TLS, multi-user identity, repository protocol hardening, runner isolation, backup/restore proof, external security review and real owner-machine evidence remain release gates.
