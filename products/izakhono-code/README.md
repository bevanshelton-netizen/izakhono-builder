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

Install Node.js 20+ and Git for Windows, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\START-IZAKHONO-CODE.ps1
```

Open `http://127.0.0.1:4177`. The owner token is generated locally under ProgramData and is never committed.

## Readiness boundary

Complete Alpha means the product surface is present for controlled owner testing. It is not commercial GA. Server migration, TLS, multi-user identity, repository protocol hardening, runner isolation, backup/restore proof, external security review and real owner-machine evidence remain release gates.
