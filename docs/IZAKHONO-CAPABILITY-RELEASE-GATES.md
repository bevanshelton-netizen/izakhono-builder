# IZAKHONO Capability Release Gates

A service may be sold as LIVE only when its real transaction path has passed verification.

## Domain
1. Availability confirmed against authoritative/registrar source.
2. Registration transaction succeeds.
3. Registry/RDAP confirms the registration.
4. Nameservers resolve.
5. DNS records are verified.
6. Renewal/expiry state is recorded.
7. Customer handover is tested.

## Business email
1. Mailbox exists.
2. Authentication is configured (SPF/DKIM/DMARC as applicable).
3. Outbound send succeeds.
4. Inbound receive succeeds.
5. Bounce/error path is tested.
6. Customer credentials/handover are completed.

## Website hosting
1. Production deployment is READY.
2. Customer domain is attached.
3. HTTPS resolves.
4. Core routes work.
5. Mobile/desktop smoke test passes.

## Payment
1. Payment provider transaction path is real.
2. Server-side confirmation is verified.
3. Fulfilment is gated on confirmed payment.
4. Refund/error paths are recorded.

## Release rule
No marketing, invoice line, dashboard badge, or customer handover may say LIVE when a gate above is incomplete. Use explicit states such as READY, PENDING ACTIVATION, BLOCKED, or TEST ONLY.

## External authority boundary
IZAKHONO can build and own the registry/registrar technology, but public .co.za provisioning requires ZARC accreditation and successful technical/legal onboarding. A public new gTLD additionally requires the applicable ICANN/root-zone process.
