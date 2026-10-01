# IZAKHONO HOST — Customer #001 Activation Runbook

## Customer
- Domain: xqwaxqwamile.com
- Customer: !XQWAXQWAMILÉ HOLDINGS (PTY) LTD
- Vercel project: xqwaxqwamile-holdings
- Project ID: prj_2G8Tyz2bIbvSW6sKhcJJx1LPWfoA

## Current gate
The production Vercel deployment is READY, but public DNS for xqwaxqwamile.com has not been verified as resolving. Do not mark the customer live until public DNS and HTTPS are independently verified.

## Required provider secrets
Configure these only as server-side runtime secrets:
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- VERCEL_TOKEN
- VERCEL_TEAM_ID

Never put provider tokens in browser code, Git commits, issue comments, or customer handover documents.

## Activation sequence
1. Verify the Cloudflare zone for xqwaxqwamile.com exists and is active.
2. Apply/verify:
   - A @ -> 76.76.21.21, DNS only
   - CNAME www -> cname.vercel-dns.com, DNS only
3. Verify public DNS from an external resolver.
4. Attach xqwaxqwamile.com to the Vercel project.
5. If Vercel returns a verification challenge, apply exactly the returned challenge record and verify again.
6. Verify HTTPS for both apex and www.
7. Configure the selected mail provider and publish its MX, SPF, DKIM and DMARC records.
8. Create the five planned mailboxes:
   - info@
   - calvin@
   - projects@
   - diamonds@
   - tenders@
9. Test inbound and outbound mail.
10. Only then mark the HOST site, DNS, SSL and mail stages verified and prepare the final handover.

## Evidence requirements
A stage is not complete because a configuration was intended or previously entered. Each stage requires current evidence:
- DNS: external resolution
- Domain: Vercel project-domain attachment/verification
- SSL: successful HTTPS response
- Mail: MX plus authenticated send/receive test
- Billing: payment evidence before changing invoice/subscription state

## Customer #001 rule
Do not infer payment clearance, email activation, SSL issuance, or domain attachment from historical screenshots or database bootstrap records.

## CI validation
Any change under products/izakhono-host/** triggers the IZAKHONO HOST CI workflow. This update intentionally triggers a fresh HOST validation run.
