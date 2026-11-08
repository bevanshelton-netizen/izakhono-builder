# IZAKHONO GLOBAL — Emergency Communications & Resilience Specification

**Status:** Engineering baseline / pre-production  
**Device strategy:** Existing consumer smartphones first (Android and iPhone).

## 1. Mission
Keep people connected through every supported communication path, while being honest when no path is available. No app can overcome every simultaneous failure of power, radio coverage, internet, satellite visibility and infrastructure.

The testable promise: detect a failed path, evaluate every other eligible and consented path, preserve undelivered emergency information safely, and report its exact delivery state. Never show "help contacted" unless a trusted receiving endpoint or human responder confirms it.

## 2. Smartphone experience
- Push-to-talk one-to-one and groups; private voice; voice messages; text and location sharing.
- Persistent, accessible SOS entry point and trusted-contact management.
- Share best available location with capture timestamp and reported accuracy.
- Show queued, attempting, sent, delivered, acknowledged, failed or expired.
- Provide retry and nearby human-assistance guidance if all routes fail.
- Keep native emergency calling accessible; do not silently place emergency calls.

## 3. Communication paths
| Path | Function | Limitation |
|---|---|---|
| Internet PTT / VoIP | Voice and groups over Wi-Fi/mobile data | Requires working IP connectivity |
| Cellular voice | Native carrier voice and emergency dialler handoff | Availability is carrier/SIM/coverage dependent; user action required |
| SMS | Short alert and callback/location link | Requires supported cellular service and permissions |
| Nearby device relay | Compact alert to a consenting nearby compatible device | OS/background restrictions; not guaranteed mesh coverage |
| Satellite messaging | Supported emergency/text payloads | Device, plan, sky view, geography and provider restrictions |
| Store-and-forward | Preserve an expiring encrypted message for later retry | Cannot reach anyone until a route returns |

Route eligibility requires explicit capability, current availability and any required consent. Unknown means unavailable. Never infer support from a device model name.

## 4. Failover policy
1. Detect loss/degradation of the active path.
2. Preserve event identity and idempotency key across retries.
3. Evaluate fresh capability and availability signals.
4. Attempt eligible routes in policy order, respecting permissions and provider rules.
5. Record attempts and trusted receipts.
6. Retry queued alerts with bounded backoff and expiry; avoid battery-draining loops.
7. Update the user truthfully. If all routes fail, say so clearly.

The first implementation is a pure route-selection and delivery-state core in network/emergency-communications-core.mjs. Native OS and provider adapters remain separate.

## 5. Delivery semantics
- **Queued:** saved; no transmission confirmed.
- **Attempting:** transport attempt started; no receipt yet.
- **Sent:** trusted transport accepted it; recipient delivery is not proven.
- **Delivered:** trusted endpoint/provider confirms delivery to the destination.
- **Acknowledged:** intended human or authorised responder explicitly confirms receipt.
- **Failed / Expired:** delivery failed or validity window elapsed.

Delivery is not human acknowledgement. Acknowledgement must identify the acknowledging party and timestamp.

## 6. Security and privacy
- Encrypt in transit and protect queued content at rest using platform secure storage.
- Minimise location collection; disclose age and accuracy; use short retention unless a lawful, disclosed need applies.
- Authenticate users/devices; enforce group membership, role permissions, blocking and abuse controls.
- Do not expose provider secrets or emergency-contact data in client logs.
- Keep auditable security events without unnecessary copies of sensitive payloads.

## 7. Platform realities
Android and iOS differ in background execution, microphone, Bluetooth, local networking, location and satellite restrictions. Implement native adapters and test real devices. Do not claim always-on microphone, guaranteed background relay, automatic cellular handover or universal satellite access.

## 8. South African launch gates
Obtain specialist South African legal/regulatory review for the exact service model: electronic communications licensing classification, emergency-call handling, POPIA, RICA where relevant, location processing, consumer disclosures, recording/consent, number use, interconnection and provider contracts. Do not market the app as a replacement for national emergency calling. Public emergency-service integrations require formal agreements, verified routing, operational staffing and drills.

## 9. Acceptance tests
- Unknown/stale route state is unavailable; no route without explicit support and availability.
- Consent-required paths are excluded until consent is granted.
- Fallback order is deterministic; event IDs remain stable across retries.
- Sent, delivered and acknowledged require distinct evidence.
- Android/iPhone tests across South African networks, roaming, weak signal, Wi-Fi loss, voice-only, SMS-only, locked screen, battery saver and permission denial.
- Nearby relay and satellite features tested only on supported devices/plans/geographies.
- End-to-end drills use designated test recipients; never call public emergency services for testing without coordination.

## 10. Phased delivery
**Phase 1:** smartphone accounts, contacts, PTT, private voice, groups, messaging and receipts.  
**Phase 2:** SOS, trusted contacts, timestamped location, secure queue and incident timeline.  
**Phase 3:** native call handoff, SMS adapters, network-aware retry and supported satellite integrations.  
**Phase 4:** opt-in nearby relay proof of concept with OS/battery testing.  
**Phase 5:** NAV/fleet incident integration and authorised responder workflows.

## 11. Release definition
No public emergency-service, satellite, offline-mesh, automatic fallback or always-reachable claim until device/provider/geography tests and legal approvals pass. The first release must prove calling, group communication, SOS, timestamped location, truthful delivery states and tested fallback routes.