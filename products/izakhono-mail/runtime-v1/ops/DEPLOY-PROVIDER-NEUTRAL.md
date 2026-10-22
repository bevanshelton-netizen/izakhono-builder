# IZAKHONO MAIL — Provider-Neutral Deployment

NODE01 is optional. The mail runtime can be deployed to any suitable public Linux/Docker compute provider without changing the application architecture.

## Required runtime contract

- Ubuntu 24.04 LTS or equivalent Linux
- Docker Engine + Compose v2
- Public IPv4; IPv6 recommended
- TCP 25, 465, 587, 993 reachable
- TCP 80/443 reachable for webmail/TLS
- Stable hostname: `mail.izakhonoafrica.co.za`
- Reverse DNS/PTR: public IP → `mail.izakhonoafrica.co.za`
- Persistent storage for mail, state, logs and databases

## Deployment principle

The provider supplies compute and network reachability only. IZAKHONO retains the mail runtime definition, mailbox configuration, DNS contract, security policy, backups and operational procedures.

Provider replacement must require only:

1. provision replacement compute;
2. attach/restore persistent mail data;
3. apply the same DNS/PTR contract;
4. run the runtime bootstrap;
5. execute acceptance tests;
6. switch traffic only after verification.

## Acceptance gate

Do not mark production-ready until all of the following are verified:

- HTTPS webmail
- IMAPS authentication
- SMTP submission
- outbound delivery
- inbound delivery
- SPF
- DKIM
- DMARC
- TLS certificate validity
- backup creation and restore test
- mailbox login for `bevans@izakhonoafrica.co.za`

NODE01 is therefore a preferred owned runtime, not a prerequisite for IZAKHONO MAIL.
