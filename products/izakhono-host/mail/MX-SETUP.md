# IZAKHONO MAIL DNS contract

For each production domain, publish DNS only after the owned mail edge has a verified public address.

Required records include:

- MX → the owned mail hostname
- SPF TXT authorizing the owned outbound mail path
- DKIM TXT for the generated Stalwart selector/key
- DMARC TXT policy
- A/AAAA for the public mail hostname
- TLS certificate coverage for the public mail hostname
- Optional MTA-STS/TLS-RPT/autoconfig records as appropriate

Do not replace an existing production MX record until the new mail server has passed outbound SMTP, inbound delivery, IMAPS authentication, and TLS acceptance tests.
