# IZAKHONO Open Economy — Regulatory, Privacy & Customer Controls Register

**Market:** South Africa initial market  
**Status:** Review checklist for qualified South African legal, tax, privacy and regulatory advisers; not a legal opinion  
**Rule:** Assess the exact activity, entity, funds flow, customer journey and provider role before launch.

## 1. Activity-based perimeter review

Do not classify the whole IZAKHONO group as “regulated” or “unregulated”. Assess each SKU and each step in its customer and funds flow.

| Activity under consideration | Required review question | Safe launch boundary pending written review |
|---|---|---|
| Software subscription / SaaS | Does the product perform only software administration or also a regulated function? | Sell only the verified software function under clear terms |
| Infrastructure assessment / implementation | Are professional services, outsourcing, security or sector-specific obligations triggered? | Fixed scope, clear deliverables, liability and customer responsibilities |
| Internet/connectivity resale or referral | Does the model require communications-sector licensing, resale authority or a specific provider appointment? | Discovery/coordination only until counsel confirms the permitted model and contract |
| MVNO/MVNE, SIM/eSIM or numbering | Which entity holds the relevant permissions, numbering rights, network agreements and customer obligations? | No sale, activation or customer representation before written clearance and executed agreements |
| Voice, PSTN, SIP or emergency calling | Who is responsible for numbering, portability, lawful interception, emergency routing and service continuity? | No public voice/numbering/emergency claims before provider and legal acceptance |
| SMS / messaging | Who is the originating service provider, what consent and opt-out rules apply, and what delivery evidence is available? | No carrier-confirmed delivery claim without verified upstream receipt |
| Payment acceptance / merchant acquiring | Which entity contracts with the merchant, accepts payment instructions, holds funds, settles or handles disputes? | Use appropriately authorised providers; do not custody, acquire or settle funds absent required permissions |
| Payment initiation / account information / stored value | Does the exact flow fall within a regulated payment activity or require scheme/provider approval? | Do not enable until written perimeter review and partner approval |
| Credit / lending / funding referral | Is IZAKHONO arranging, originating, advising, underwriting or merely referring? Which credit/intermediary rules apply? | No credit offer or approval claim; referrals only under approved written model |
| Identity / KYC / verification | What statutory, contractual and privacy obligations apply to each data source and verification decision? | Minimise data; disclose purpose; use authorised sources and documented decision controls |
| Hosting / cloud / backups | What data-location, sector, security, outsourcing and breach requirements apply to the customer and service? | Publish only verified locations, controls, restore capability and service scope |

## 2. Mandatory review outputs

Before a SKU passes legal/regulatory gate, retain:
1. Legal entity delivering the service and contracting with the customer.
2. Activity diagram showing every actor, customer instruction, data flow, funds flow and provider hand-off.
3. Written classification/perimeter advice from appropriately qualified counsel or adviser.
4. Required licences, registrations, scheme rules, provider permissions and evidence of their scope.
5. Responsibility matrix for customer disclosures, complaints, refunds, disputes, incidents and regulatory reporting.
6. Contract, order form, service description, pricing/tax treatment and cancellation/exit terms.
7. Evidence that the public website and sales materials describe only the approved service.

## 3. Privacy and information governance

For each processing purpose, document:
- data categories, data subjects, source and destination;
- purpose and lawful basis;
- responsible party/operator roles and written operator terms where needed;
- minimum data required and whether sensitive/special personal information is involved;
- access roles, authentication, encryption, audit and secure transfer;
- retention period, deletion/return, backup expiry and legal hold;
- sub-operators, hosting locations and any cross-border transfers;
- data subject request and complaint handling;
- incident detection, escalation, notification and evidence preservation.

Controls:
- Privacy notices must be clear, current and specific to the actual service.
- Do not use customer or provider data for unrelated analytics, marketing or model training without a reviewed lawful basis and appropriate notice/consent.
- Do not disclose FORTRESS risk signals, detection methods or sensitive security architecture to partners without controlled need-to-know disclosure and suitable confidentiality terms.
- Never put credentials, full payment details or unnecessary personal data in application logs, analytics or support tickets.
- Test deletion, access restriction, export and correction workflows where applicable.

## 4. Payments and financial controls

- Identify the merchant of record and contractual provider for each payment flow.
- Keep payment authorization, provider settlement, internal ledger posting and customer order fulfilment as distinct evidenced events.
- Use immutable transaction references, minor-unit amounts, explicit currency and verified provider status.
- Verify webhook signatures and reconcile to authoritative provider APIs/statements.
- Implement duplicate/replay protection, refund/dispute states, exception queues and daily reconciliation where required.
- Never infer settlement from checkout success or a browser redirect.
- No real-money pilot until provider onboarding, merchant underwriting, credentials, contracts, testing and approval are complete.

## 5. Customer protection and claims

Every customer-facing SKU must state:
- what is included and excluded;
- whether it is planned, sandbox, pilot, contracted or production-verified;
- who supplies each third-party service;
- coverage/serviceability limits and dependencies;
- price, tax, pass-through charges, renewal and price-change rules;
- support hours, incident channel, response targets and escalation;
- cancellation, refund, dispute and complaint routes;
- data processing, retention and third-party sharing;
- service availability and remedies only where contractually supported.

Do not claim guaranteed uptime, speed, coverage, emergency calling, instant activation, regulatory approval, certification or partnership unless current documentary evidence supports the exact statement.

## 6. Launch approval record

Each SKU requires an approval record with:
- SKU ID and version;
- legal entity and accountable product owner;
- customer segment and geography;
- exact service and customer journey;
- activity/perimeter opinion reference and date;
- required permission/provider agreement references;
- privacy/data-flow review;
- customer contract and public claims review;
- finance/tax and margin approval;
- technical/security/operational evidence;
- production environment and independent acceptance evidence;
- named go/no-go approvers and decision timestamp.

Any material change to funds flow, provider, data use, geography, service capability or customer terms reopens the relevant review.

## 7. Open items for counsel and accountable owners

- Confirm IZAKHONO legal entity, tax registration and contracting authority for each offer.
- Confirm communications-sector perimeter for each connectivity distribution/resale/managed-service model.
- Confirm payment perimeter for I-PAY and all proposed provider integrations.
- Confirm POPIA roles, privacy notices, operator agreements, retention and cross-border processing.
- Confirm consumer/business customer disclosure, electronic contracting and cancellation requirements.
- Confirm credit/funding referral perimeter for any KORA-related activity.
- Confirm sector-specific outsourcing, security, incident and recordkeeping obligations for enterprise/public customers.

No SKU is enabled solely because this register exists. The written review and supporting evidence must be attached to the SKU's release record.
