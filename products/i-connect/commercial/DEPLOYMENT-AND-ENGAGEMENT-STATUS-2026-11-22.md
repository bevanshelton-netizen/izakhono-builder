# I-CONNECT — Deployment and Partner Engagement Status

**As of:** 22 November 2026  
**Programme owner:** IZAKHONO Africa (Pty) Ltd  
**Production target:** IZAKHONO-owned HOST infrastructure  
**Release posture:** Not deployed; production activation remains blocked by missing physical-host evidence.

## 1. Deployment decision

Do not deploy this release to production yet. The source release package exists, but the required evidence from an authorised IZAKHONO-controlled execution target is not available in the repository or connected deployment context.

### Evidence available

- I-CONNECT has an owned Docker/Compose deployment path with Caddy edge proxy, health checks, backup and recovery scripts.
- The deployment script invokes both preflight and owned-node admission before build/start.
- The release attestation template still has the target hostname, owner/control, OS, Docker versions, deployed commit, health, DNS/TLS, backup, restore, attestor and timestamp marked TBD.
- The production activation document requires a dedicated I-CONNECT Supabase project and protected runtime configuration; no production secret values belong in Git.
- The logical NODE01 identity is not evidence of a physical host or authorised shell.

### Missing release evidence

1. A verified, authorised HOST execution session or approved deployment runner bound to the physical target.
2. Physical host identity, ownership/control evidence and root-level deployment authority.
3. Runtime/node registration confirmation against the authoritative Runtime Fabric registry.
4. Target-node preflight and admission output from the actual host.
5. Dedicated I-CONNECT database project and approved migration/backup/restore evidence.
6. Protected environment configuration and secret custody on the target host.
7. Public reachability, DNS/TLS, monitoring, backup and restore acceptance where required.

### Vercel staging assessment

The Vercel account contains an i-connect-staging project with a previous READY staging deployment. The project is marked live=false, SSO-protected, and the current I-CONNECT feature branch has no deployment in that project. The project is configured as Vite while the current I-CONNECT application entry point is an Express/Node portable container. The repository deployment context does not identify this staging project as a linked Git project.

Decision: do not force a Vercel deployment or change project settings to make it appear live. Vercel remains a fallback only; it is not the production path and no DNS/domain changes are authorised.

## 2. Release sequence once access is verified

1. Confirm the authorised HOST execution session and physical target.
2. Confirm the target is registered and authorised in Runtime Fabric.
3. Review source commit, release attestation, secrets and dedicated database ownership.
4. Run read-only preflight and admission checks on the target.
5. Build and deploy the owned Docker/Compose stack only after both gates pass.
6. Verify container health, external reachability, TLS, monitoring, backups and a restore rehearsal.
7. Keep PSTN, live carrier fulfilment and real billing disabled until their separate partner, legal, security and payment gates pass.
8. Record actual node evidence in the release attestation. Never infer production status from GitHub CI or a cloud preview.

## 3. Partner engagement status

### MTN

The 22 November follow-up to Group Corporate Affairs was sent successfully from the IZAKHONO mailbox. It requests routing to MTN South Africa Wholesale, MVNO/MVNE or Enterprise Connectivity and relevant SME digital-services owners. No response or named decision-maker is evidenced yet.

Next: allow the request to route. If there is no response, use MTN's published Group switchboard, 011 912 4123, and ask for the South Africa Wholesale/MVNO/Enterprise Partnerships office. Do not treat Group Corporate Affairs or the switchboard as a commercial sponsor.

### Telkom

The 22 November follow-up to business@telkom.co.za was rejected by Telkom's inbound Mimecast gateway with SMTP 554 / status 5.7.0. The message is not a delivered engagement.

Verified alternative official routes:
- Telkom IT Services Reseller application: https://www.telkom.co.za/reseller-applications. The form asks for company name, contact person, telephone, email, website, regions serviced, industry category, services offered and annual turnover.
- Telkom Group Procurement: supplier onboarding and Ariba registration guidance.
- Telkom Business official site: use its published business contact route / 10213 to request the correct Business Partnerships or digital-services owner.
- Telkom FutureMakers: Enterprise Development / Accelerator and Supplier Development programme information. The 2026 Township Incubator application window closed on 18 October 2026; this is not an open application route today.

The reseller form has not been submitted because several required company fields (telephone, website, regions served and annual turnover) are not verified in the current company profile. Supplier/FutureMakers eligibility has not been assessed. No application has been submitted and no appointment is claimed.

## 4. Meeting objective and pilot ask

Request a 30-minute discovery meeting, not a commitment. The proposed discussion is:

1. Confirm the relevant business unit and accountable commercial/technical owners.
2. Assess one non-exclusive SME pilot combining the partner's connectivity reach with IZAKHONO's customer onboarding, business applications, integration and support.
3. Establish geographic/serviceability scope, wholesale or channel model, customer ownership, commercial attribution and support boundaries.
4. Request the approved partner onboarding path, product/pricebook documentation, sandbox and certification requirements.
5. Agree a named owner, information exchange under appropriate confidentiality, and a dated next step.

No pricing, coverage, reseller appointment, wholesale access, API availability or integration is represented as confirmed.

## 5. Commercial guardrails

- Start with software, assessment and implementation services that IZAKHONO can genuinely deliver.
- Keep carrier connectivity as a provider-dependent SKU until contract, approved pricebook, serviceability, technical certification and support are complete.
- Keep HOST services production-gated until physical infrastructure acceptance.
- Keep real payments and regulated acquiring activity behind I-PAY/provider approval.
- Record each status separately as contacted, routed, meeting requested, meeting held, due diligence, contracted, sandbox certified or production verified.
