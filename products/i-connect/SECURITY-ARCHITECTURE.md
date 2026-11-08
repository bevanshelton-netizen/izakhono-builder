# IZAKHONO GLOBAL — Security Architecture & Threat Model

**Status:** Mandatory engineering baseline / pre-production
**Security owner:** IZAKHONO FORTRESS security control plane
**Scope:** I-CONNECT, IZAKHONO GLOBAL communications, emergency workflows, device clients, provider adapters and operational systems.

## 1. Security objective

Protect the confidentiality, integrity, availability and authenticity of communications, identities, location data, emergency alerts, account records and provider connections. Assume hostile networks, compromised devices, malicious users, credential theft, supply-chain compromise and infrastructure failure.

No system is literally impenetrable. The design objective is prevention, containment, detection, evidence preservation and safe recovery. Security controls must not create a single point of failure that disables emergency access.

## 2. Mandatory architecture principles

- Zero trust: authenticate and authorise every request; never trust a network location.
- Least privilege: every user, service, device and operator receives only the minimum required access.
- Default deny: new routes, integrations, ports, permissions and provider capabilities remain disabled until explicitly approved.
- Defence in depth: independent controls at device, identity, API, service, data, network and operations layers.
- Secure by design: threat modelling, code review, automated testing and security acceptance are release gates.
- Fail safely: on uncertain identity, policy or provider state, deny sensitive actions while preserving safe local emergency guidance.
- No secret in source control, client bundles, logs, analytics or support exports.
- Provider and infrastructure portability: security policy remains owned by IZAKHONO when compute or telecom providers change.

## 3. Identity, devices and sessions

- Phishing-resistant MFA for privileged operators; passkeys where supported, with secure recovery.
- Short-lived access tokens, rotating refresh tokens, revocation and device/session inventory.
- Device registration and risk signals; do not treat a device identifier as proof of identity.
- Step-up authentication for account recovery, changing emergency contacts, exporting data, changing group ownership or privileged administration.
- Strong account recovery with abuse detection, cooling-off controls and user notification.
- Separate consumer, enterprise administrator, support agent, responder and platform operator roles.
- Privileged access through time-bound just-in-time grants with approval and immutable audit events.

## 4. Communications privacy and cryptography

- Use established, independently reviewed end-to-end encryption protocols and audited libraries; do not invent cryptographic algorithms or protocols.
- Encrypt private and group communications end-to-end where product functionality permits. Clearly disclose any feature that cannot be end-to-end encrypted.
- Authenticate group membership and key changes; remove departed members from future group keys and rotate keys after membership changes.
- Protect data in transit with current TLS configurations and authenticated service-to-service identity.
- Protect queued local messages with platform secure storage and encryption keys held in hardware-backed keystores where available.
- Minimise metadata. Encryption does not hide all metadata such as timing, IP addresses, routing and recipient relationships; document this honestly.
- Define key generation, rotation, revocation, backup, recovery and compromise response. Do not store plaintext private keys in ordinary databases.
- Emergency SMS, carrier voice and third-party satellite transports may not provide the same end-to-end confidentiality. Warn users and minimise payloads on those paths.

## 5. API, application and infrastructure security

- API gateway with schema validation, strict authentication/authorisation, rate limits, abuse controls and request size limits.
- Validate every object-level permission server-side to prevent IDOR/BOLA and tenant-boundary failures.
- Use parameterised database queries and strict input/output validation; encode untrusted output.
- Protect against CSRF where cookie-based sessions are used; configure CORS with explicit trusted origins, never wildcard credentials.
- Enforce replay protection, idempotency and signed webhook verification with timestamp tolerance and key rotation.
- Isolate workloads and environments; separate production, staging, development and test credentials/data.
- Private network boundaries, outbound egress controls, managed secrets, encrypted backups and hardened container images.
- No public database, admin panel, object store or internal control plane by default.
- Patch operating systems, dependencies, base images and mobile SDKs; maintain a software bill of materials and vulnerability response process.
- Sign release artifacts and verify provenance; protect build pipelines and repository permissions.

## 6. Emergency-service security and availability

- SOS must not become a remote-control path into the user's phone. No arbitrary remote microphone activation, camera activation or hidden tracking.
- A trusted contact or responder may receive only the information and capabilities explicitly authorised by the user or a documented lawful emergency process.
- Prevent attackers from spoofing SOS, delivery receipts, responder identities or acknowledgement events.
- Signed, replay-protected receipts distinguish provider acceptance, endpoint delivery and human acknowledgement.
- Protect emergency workflows from denial-of-service using layered rate limits, abuse detection and reserved service capacity.
- Do not let a compromised ordinary user account access another user's emergency history or location.
- Preserve a minimal safe emergency workflow if analytics, recommendations or nonessential AI services are unavailable.
- No claim of guaranteed emergency reachability; report transport limitations truthfully.

## 7. Data governance and privacy

- Classify identity, contact, location, voice, message, payment and emergency incident data separately.
- Collect the minimum data required for a disclosed purpose; make location sharing visible and controllable.
- Define retention and deletion schedules, legal holds, access logs and secure disposal.
- Restrict staff access to sensitive records; require a documented purpose and audit trail.
- Do not use private communications or precise location for advertising or unrelated profiling.
- Complete a POPIA privacy impact assessment and obtain South African legal review before launch; assess cross-border processing and provider subprocessors.

## 8. Monitoring, detection and response

- Centralise security events without indiscriminately logging message bodies, credentials or precise location.
- Alert on credential stuffing, impossible travel, unusual device enrolment, privilege escalation, bulk exports, webhook abuse and anomalous traffic.
- Maintain tamper-evident audit logs and synchronised timestamps.
- Prepare incident playbooks for account takeover, lost devices, key compromise, data breach, malicious insider, provider compromise and ransomware.
- Define 24/7 escalation expectations before selling a 24/7 safety service.
- Test backup restoration, credential revocation, key rotation and recovery exercises.
- Notify affected users and regulators as required by applicable law and approved incident procedures.

## 9. Secure development and independent assurance

- Threat model every major feature and trust boundary before implementation.
- Require peer review, static analysis, dependency scanning, secret scanning and software composition analysis.
- Add unit, integration, authorisation, abuse, fuzz and regression tests to CI.
- Commission independent penetration tests and mobile application security assessments before public launch and after major architecture changes.
- Maintain a vulnerability disclosure and coordinated remediation process.
- No production launch with unresolved critical/high security findings without documented risk acceptance by accountable leadership.
- Keep a release evidence pack: threat model, test results, dependency inventory, penetration test summary, remediation record and approval.

## 10. Security versus availability

Security controls must protect users without creating false assurance or blocking lawful emergency access. Emergency fallbacks are separately authorised and deliberately narrow. No hidden backdoor, universal master key or unaudited support override is permitted. Break-glass access, if legally and operationally required, must be narrowly scoped, time-limited, independently approved, fully logged and reviewed.

## 11. Release gates

Public launch is blocked until:

1. Authentication, account recovery and privileged access controls pass testing.
2. Message encryption design and key lifecycle receive independent cryptographic review.
3. Tenant isolation, object authorisation, API abuse and webhook verification tests pass.
4. Mobile application security testing passes on supported Android and iOS versions.
5. Data protection impact assessment and South African legal review are complete.
6. Incident response, support escalation, backup restore and key-compromise exercises are demonstrated.
7. Independent penetration testing has no unresolved critical/high findings, or approved documented exceptions.
8. Emergency fallback and delivery claims are proven on supported devices/providers and clearly disclosed.

**Non-negotiable:** FORTRESS is the security policy and assurance layer. No product team, carrier adapter, support workflow or infrastructure provider may bypass it.