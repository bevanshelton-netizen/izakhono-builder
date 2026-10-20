# XQWAXQWAMILÉ HOLDINGS — OWNED DEPLOYMENT MANIFEST

Status: READY FOR OWNED-RUNTIME ACTIVATION

## Customer

- Legal/customer name: !XQWAXQWAMILÉ HOLDINGS (PTY) LTD
- Registration: 2017/315075/07
- Primary domain: xqwaxqwamile.com
- Canonical hostname: www.xqwaxqwamile.com
- South African domain: xqwaxqwamile.co.za
- South African canonical hostname: www.xqwaxqwamile.co.za

## Runtime

- Runtime of record: IZAKHONO HOST native runtime
- Edge: IZAKHONO HOST Caddy
- DNS: IZAKHONO authoritative DNS
- Fallback: Vercel
- Source: `bevanshelton-netizen/Downloads`, `sites/xqwaxqwamile-holdings`
- Deployment model: typed content deployment through the authenticated host-runtime API

## Provisioning sequence

1. Provision `xqwaxqwamile.com` on the owned runtime.
2. Deploy the approved static site content through `/api/sites/:id/content`.
3. Configure DNS records to the owned edge.
4. Verify HTTP reachability and Caddy TLS issuance.
5. Verify both `.com` and `.co.za` customer hostnames.
6. Run content, DNS and HTTPS acceptance.
7. Only after all three acceptance gates pass, mark the site `live`.

## Mailboxes

The customer mail plan remains:

- info@xqwaxqwamile.com
- calvin@xqwaxqwamile.com
- projects@xqwaxqwamile.com
- diamonds@xqwaxqwamile.com
- tenders@xqwaxqwamile.com

Mailbox creation is a separate mail-engine acceptance gate and must not be represented as live until transport, MX, SPF, DKIM, DMARC, inbound and outbound tests pass.

## Safety gates

- Never commit runtime tokens, SMTP credentials, private keys or DNS secrets.
- Never mark the customer live from repository state alone.
- Never claim mail delivery from API acceptance alone; require transport evidence.
- Vercel remains reversible fallback infrastructure until owned hosting is accepted.
