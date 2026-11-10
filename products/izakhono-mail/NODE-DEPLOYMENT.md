# IZAKHONO MAIL — Owned NODE Deployment

## Canonical runtime

Use the existing IZAKHONO HOST mail plane. Do not deploy a second, competing mail stack.

- HOST runtime: `products/izakhono-host/docker-compose.owned.yml`
- Stalwart SMTP/IMAP/JMAP server: `products/izakhono-host/mail/docker-compose.mail.yml`
- Activation helper: `products/izakhono-host/mail/STALWART-ACTIVATE.sh`
- HOST-to-mail bridge: `products/izakhono-host/runtime/mail-bridge`

The Stalwart service joins the HOST-created external Docker network `izakhono-mail`. The bridge reaches it using the service DNS name `stalwart` on that private network. Do not expose the bridge API publicly.

## NODE activation

Run on the approved existing MAIL-capable owned NODE after its normal preflight and secure secret injection:

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

The `.env` file must be created on the NODE from the approved secret store. It must contain the required HOST secrets, `STALWART_RECOVERY_ADMIN`, `IZAKHONO_MAIL_API_TOKEN`, and the dedicated SMTP submission credentials. Set `SMTP_HOST=stalwart`, `SMTP_PORT=465`, and `SMTP_TLS_MODE=tls` for the mail bridge. Credentials must never be committed to Git or sent in chat.

## Network and domain gates

Before public mail traffic is enabled, confirm the selected NODE has a stable public IP and that the required ports are reachable: TCP 25, 465, 587, 993 and the approved webmail/HTTPS route. Resolve any existing 443 listener conflict through the approved EDGE routing design; do not blindly publish another service on 443.

Verify ownership and existing provider dependencies for each domain. Do not change MX records until the existing mailboxes and a safe migration/cutover plan are confirmed. Publish only the records generated for the verified domain: MX, SPF, DKIM and DMARC. Confirm PTR/reverse DNS, TLS, inbound delivery, authenticated outbound submission, IMAP login, external reply, spam controls, rate limits and backup/restore.

## Acceptance

The source deployment is prepared, not live. Record current evidence for NODE health, container health, public reachability, DNS, TLS, SMTP send/receive, IMAP authentication, DKIM/SPF/DMARC alignment, abuse controls and restore. Only then may the control plane mark the service verified/live.
