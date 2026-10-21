# XQWAXQWAMILÉ — OWNED MAIL ACTIVATION CHECKLIST

This is the final operator gate for moving the XQ mail service from repository-ready to real-world acceptance.

## 1. Start the owned mail runtime

```bash
cd products/izakhono-host/mail
export STALWART_RECOVERY_ADMIN='USE_THE_PROTECTED_RUNTIME_SECRET'
./STALWART-ACTIVATE.sh
```

Never commit or paste the recovery credential into GitHub.

## 2. Configure the XQ domains

Domains:

- `xqwaxqwamile.com`
- `xqwaxqwamile.co.za`

The authoritative DNS and public edge must point to the owned infrastructure before production promotion.

## 3. Create the five mailboxes

Create these accounts in the owned Stalwart tenant/domain configuration:

- `info@xqwaxqwamile.com`
- `calvin@xqwaxqwamile.com`
- `projects@xqwaxqwamile.com`
- `diamonds@xqwaxqwamile.com`
- `tenders@xqwaxqwamile.com`

Passwords must be generated and delivered through a protected channel; never commit them.

## 4. Publish mail DNS

Required acceptance records:

- MX
- SPF
- DKIM
- DMARC
- A/AAAA for the mail host
- TLS/MTA-STS/TLS-RPT where applicable

Do not cut over MX until the owned service is healthy and the acceptance checks are ready.

## 5. Real acceptance test

Prove all of the following:

- external DNS resolves correctly
- IMAPS TLS handshake succeeds
- authenticated mailbox login succeeds
- external inbound message reaches the mailbox
- mailbox can send externally
- sent/received message is visible through IMAP/JMAP
- TLS certificates are trusted
- no false `LIVE` status is emitted when any gate fails

## Promotion rule

Status remains **PENDING** until all required gates have current evidence. A successful repository build, Docker image, or configuration check is not proof that public email is live.
