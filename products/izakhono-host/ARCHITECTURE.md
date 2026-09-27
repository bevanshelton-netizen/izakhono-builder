# IZAKHONO HOST — Production Architecture

## Product
Owned-first website and business-email hosting for IZAKHONO portfolio products and external customers.

## Web hosting plane
- IZAKHONO DNS -> EDGE/TLS -> reverse proxy -> tenant runtime
- container-per-site or isolated tenant service
- automated Let's Encrypt TLS
- static sites, Node/Python/PHP-compatible runtime adapters
- PostgreSQL/Supabase-compatible database adapter
- daily encrypted backup and restore manifest
- Website Factory direct deploy adapter
- external hosting remains reversible resilience only

## Mail hosting plane
Activation-ready stack:
- Postfix-compatible SMTP ingress
- Dovecot-compatible IMAP mailbox service
- Rspamd-class spam filtering
- ClamAV-class malware scanning
- Roundcube/SOGo-compatible webmail
- per-domain DKIM signing
- SPF/DMARC generation
- TLS certificates
- mailbox quotas and aliases
- backup/restore
- outbound SMTP relay adapter for deliverability ramp-up

## Hard prerequisites before mail is called LIVE
- stable public IPv4
- PTR/rDNS matching mail hostname
- forward DNS A/AAAA
- MX record
- SPF record
- DKIM key published
- DMARC record
- port 25 inbound/outbound policy confirmed
- blocklist/reputation checks
- Gmail/Microsoft delivery test
- abuse/rate limits
- backup restore test

## Privacy
No behavioural tracking, advertising IDs, silent analytics or cross-site profiling.

## Status language
Web hosting may be called live only after HTTPS 200 and intended content verification.
Email hosting may be called live only after all mail prerequisites and external delivery tests pass.
