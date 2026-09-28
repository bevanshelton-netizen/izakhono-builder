# IZAKHONO SIGN public cutover

The public signing route is a separate gate from the internal DOCFLOW/FLOWIQ/CRM/SIGN engine.

## Order

1. Deploy and verify the internal chain.
2. Deploy IZAKHONO MAIL and bind it to SIGN.
3. Configure a real SMTP route in `/etc/izakhono/apps/izakhono-mail.env`.
4. Choose the approved SIGN hostname.
5. Run `owner-node/set-public-base.sh <repo-root> <hostname>`.
6. Run `STAGE-SIGN-EDGE.ps1 -Hostname <hostname>`.
7. Run `ACTIVATE-SIGN-EDGE.ps1` for a dry run.
8. After the DNS plan is ready, run `ACTIVATE-SIGN-EDGE.ps1 -Apply`.
9. Point the approved DNS record at the owned EDGE.
10. Verify the owned HTTPS route and an independent functional fallback with `VERIFY-SIGN-PUBLIC.ps1`.

## Public-live rule

Do not call SIGN public-live until the verifier passes:

- DNS A/AAAA resolution
- TCP 443 reachability
- HTTPS health endpoint
- expected IZAKHONO SIGN landing page
- readable TLS certificate metadata
- independently reachable HTTPS fallback

A signing invitation can only be dispatched automatically when both of these are true:

- SIGN has `SIGN_PUBLIC_BASE_URL`
- MAIL has a verified SMTP route

If SMTP is absent, MAIL queues the invitation as `awaiting_smtp`. If the public signing route is absent, SIGN remains `awaiting_public_route`. Neither state is described as sent.
