# IZAKHONO SEND

**Version:** 1.0.0

IZAKHONO SEND is the owner-controlled IZAKHONO file-transfer product intended to replace reliance on WeTransfer-style services.

## What v1 does

- browser-based multi-file uploads
- owner-controlled filesystem storage
- expiring share links
- optional maximum download-start count
- SHA-256 recorded for every uploaded file
- streaming uploads rather than loading whole files into memory
- HTTP range downloads for resumable large-file delivery
- entity-scoped transfer ownership
- explicit revoke endpoint
- automatic expired-file purging
- owner token authentication for creating/uploading/revoking transfers
- SQLite metadata
- Docker/IZAKHONO NODE deployment
- Windows standalone EXE packaging
- no OpenAI or WeTransfer runtime dependency

## Entity boundary

Every transfer has an `entity_id`.

Administrative listing is always filtered by an explicit entity ID. A transfer from one business is not automatically visible inside another business's administrative view. Public recipients only see the exact transfer represented by their high-entropy share link.

This is a technical boundary, not a substitute for intercompany legal/accounting controls.

## Storage

Default Linux data root:

`/var/lib/izakhono-send`

Default Windows data root:

`%LOCALAPPDATA%\IzakhonoSend`

Files are stored under random object names rather than directly using user-supplied filenames. Metadata is in SQLite.

## Owner token

When `IZAKHONO_SEND_ADMIN_TOKEN` is not supplied, the service generates a random token and stores it locally at:

`<data-root>/admin-token.txt`

On Windows the app opens the owner interface with the token in the URL fragment. The fragment is removed by the page and the token is retained only in browser session storage.

For a public server, set a strong token through the owner secret/configuration layer instead of exposing the generated token file.

## Limits

Defaults are owner-configurable:

- maximum file: 5 GiB
- maximum transfer: 20 GiB
- default expiry: 7 days
- maximum expiry: 30 days

These are not vendor credits. They are operator-defined safety/capacity limits and can be changed through environment variables.

## IZAKHONO NODE

Deploy using the included `izakhono-service.json` through IZAKHONO CONTROL/NODE.

The service listens on port 8787 in the container and stores persistent data at `/data`.

## Public launch gate

Do not call IZAKHONO SEND a public WeTransfer replacement until all of these are proven:

1. real owner node is online;
2. IZAKHONO EDGE/TLS exposes the service over HTTPS;
3. owner token is stored/rotated safely;
4. upload/download limits match available disk and bandwidth;
5. malware/abuse scanning and reporting controls are added before opening uploads beyond trusted owners;
6. backup/restore is tested;
7. expiry cleanup is proven;
8. external upload/download tests pass.

v1 is intentionally **owner-upload / public-download**. Public anonymous uploads are not enabled.

## Next hardening

- IZAKHONO ID sign-in and role-based owner/team uploads
- password-protected transfers
- recipient email delivery via IZAKHONO MAIL
- object storage/replication through IZAKHONO DATA
- malware scanning/quarantine
- abuse reporting and takedown controls
- transfer analytics through IZAKHONO OBSERVE/ANALYTICS
- branded custom domains
- multipart/chunk recovery for interrupted uploads
