# IZAKHONO RAPID WEBSITE DELIVERY v1

Make standard business websites a provisioning problem, not a bespoke infrastructure project.

Build path: select profile -> create from validated template -> register -> attach standard services -> build -> temporary HTTPS -> smoke test -> custom domain when available -> SSL verification -> email when available -> handover.

## Hard rule

Customer-domain and email configuration must never block the website build. A site must be usable on its temporary HTTPS route before custom DNS or mailbox work begins.

## States

- BUILD_READY
- PREVIEW_LIVE
- DOMAIN_PENDING
- DOMAIN_VERIFIED
- MAIL_PENDING
- MAIL_VERIFIED
- HANDOVER_READY
- BLOCKED_EXTERNAL

## Legitimate external gates

Domain purchase/transfer, registrar/DNS authorization, provider KYC, payment-provider approval, customer credentials/DNS access, and legal/customer acceptance are tracked as gates, not mixed into application build work.

## Engineering target

For a standard profile with no external approval dependency: provisioning under 5 minutes, build/deploy under 15 minutes, smoke verification under 5 minutes, handover in the same working session.

This is an engineering target, not a marketing claim until measured repeatedly.

## Calvin conversion

Calvin is the reference implementation. Any bespoke step used for Calvin must become a reusable template, provider adapter, evidence-gated external task, or documented exception. Future customers must not inherit Calvin's historical setup time.

## Email

Email is provisioned independently. The website can be live while mail is MAIL_PENDING. Sender identities remain evidence-gated until DNS and delivery evidence exists.

## Ownership

Customer state belongs in the IZAKHONO delivery registry/HOST control plane. External providers are replaceable adapters.
