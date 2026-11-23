# IZAKHONO MAIL — Owned Runtime Fabric Deployment

## Canonical runtime

Deploy through the existing IZAKHONO Runtime Fabric and NODE01 command gateway. NODE01 is the logical software-runtime identity; it is never the physical or virtual execution host. Runtime Fabric selects and manages the separately registered execution environment.

Use the existing IZAKHONO HOST mail plane. Do not deploy a second, competing mail stack.

- HOST runtime: `products/izakhono-host/docker-compose.owned.yml`
- Stalwart SMTP/IMAP/JMAP server: `products/izakhono-host/mail/docker-compose.mail.yml`
- Activation helper: `products/izakhono-host/mail/STALWART-ACTIVATE.sh`
- HOST-to-mail bridge: `products/izakhono-host/runtime/mail-bridge`
- Runtime Fabric workload contract: `infra/runtime-fabric/workloads/izakhono-mail.json`
- Runtime Fabric activation binding: `infra/runtime-fabric/controller/izakhono_mail_activation.py`

The Stalwart service joins the HOST-created external Docker network `izakhono-mail`. The bridge reaches it using the service DNS name `stalwart` on that private network. Do not expose the bridge API publicly.

## Execution path

```text
IZAKHONO MAIL release
        |
        v
Runtime Fabric workload registry
        |
        v
NODE01 command gateway
        |
        +--> registered execution adapter
        |       |
        |       +--> separately registered runtime environment
        |                 |
        |                 +--> existing IZAKHONO HOST stack
        |                           |
        |                           +--> Stalwart mail plane
        |                           +--> private mail bridge
        |
        +--> FORTRESS authorization + audit
        |
        v
Runtime health + mail acceptance evidence
        |
        v
LIVE_VERIFIED only after every gate passes
```

The repository currently defines the workload contract and a fail-closed activation binding. The binding deliberately accepts the real command-gateway execution and acceptance callbacks from the runtime; it does not invent an endpoint, run arbitrary shell over HTTP, or treat a configured adapter name as an active registration. The adapter is considered usable only when the gateway reports it registered, authorized by FORTRESS, bound to a healthy execution environment and able to return an audit acknowledgement.

## Required activation gates

Before execution, the registered gateway integration must provide all of these capabilities:

- `runtime.deploy`
- `mail.activate`
- `runtime.health`

The FORTRESS policy must authorize the requested tenant/environment/workload operation and retain an audit record. The Runtime Fabric binding must identify the actual execution environment separately from `logical_node_id: NODE01`. A missing or ambiguous registration fails closed.

## Runtime activation

Once the gateway adapter is actually registered and authorized, the runtime integration may execute the HOST mail activation sequence on the selected execution environment:

```bash
cd products/izakhono-host
docker compose --env-file .env -f docker-compose.owned.yml config >/dev/null
docker compose --env-file .env -f docker-compose.owned.yml up -d
docker compose --env-file .env -f mail/docker-compose.mail.yml config >/dev/null
set -a
. ./.env
set +a
bash mail/STALWART-ACTIVATE.sh
docker compose --env-file .env -f docker-compose.owned.yml ps
docker compose --env-file .env -f mail/docker-compose.mail.yml ps
```

This sequence is not to be run from an unverified workstation, a GitHub-hosted CI runner, or a guessed host. The execution adapter must run it only in the verified, authorized Runtime Fabric execution environment. The `.env` file must be injected from FORTRESS on that environment; credentials must never be committed to Git or sent in chat.

## Network and domain gates

Before public mail traffic is enabled, confirm the selected execution environment has a stable public IP and that the required ports are reachable: TCP 25, 465, 587, 993 and the approved webmail/HTTPS route. Resolve any existing 443 listener conflict through the approved EDGE routing design; do not blindly publish another service on 443.

Verify ownership and existing provider dependencies for each domain. Do not change MX records until the existing mailboxes and a safe migration/cutover plan are confirmed. Publish only the records generated for the verified domain: MX, SPF, DKIM and DMARC. Confirm PTR/reverse DNS, TLS, inbound delivery, authenticated outbound submission, IMAP login, external reply, spam controls, rate limits and backup/restore.

## Acceptance and status

The activation binding returns `BLOCKED` if the command-gateway adapter or acceptance-evidence adapter is missing. A successful adapter call is not itself proof of public production readiness.

Record current evidence for NODE/runtime health, container health, public reachability, DNS, TLS, SMTP send/receive/reply, IMAP authentication, DKIM/SPF/DMARC alignment, abuse controls and restore. Only then may the control plane mark the service `LIVE_VERIFIED`.

**Current repository status:** integration contract and fail-closed activation binding prepared; live gateway registration, FORTRESS authorization, runtime binding and execution remain unverified.
