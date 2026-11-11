# AFRICA RISE — South Africa Regulatory Readiness Gates

**Purpose:** Identify regulatory questions that must be answered before any AFRICA RISE programme offers regulated connectivity, communications, SIM/eSIM services, emergency communications or personal-data processing in South Africa.

**Important:** This is a planning checklist, not a legal opinion. Classification depends on the precise service, contracting party, network role, customer proposition and technical design. Obtain advice from South African telecommunications counsel and written guidance from ICASA where necessary before launch.

## 1. Connectivity and resale — ICASA / Electronic Communications Act

ICASA distinguishes between Electronic Communications Services (ECS) and Electronic Communications Network Services (ECNS), including individual and class licence categories. ICASA's services-licensing guidance states that resellers of electronic communications services obtained from upstream ECS providers need to apply for an ECS licence exemption. It also describes class ECS and ECNS geographical limitations and notes that a class ECS licence does not confer the right to apply for national numbering resources.

Official references:
- ICASA — Services Licensing: https://www.icasa.org.za/pages/services-licencing
- ICASA — Licensing: https://www.icasa.org.za/pages/licensing
- Electronic Communications Act 36 of 2005: https://www.gov.za/documents/electronic-communications-act

**Required legal questions:**
- Is the proposed I-CONNECT/IZAKHONO GLOBAL offer a pure software platform, an agency arrangement, a resale of upstream ECS, an ECS, an ECNS, or a combination?
- Which legal entity contracts with the end customer and invoices the service?
- Who is the licensed upstream provider and what exactly does its licence permit?
- Is an ECS exemption or class/individual ECS authorisation required for the exact model?
- Does the offer involve voice telephony using national numbering resources, numbering allocation, number portability or interconnection?
- Does any infrastructure element constitute an ECNS or use radio-frequency spectrum?
- Which party owns customer support, billing accuracy, service quality, complaints, refunds and outage communication?

**Control:** Do not describe IZAKHONO as a licensed operator, MVNO, network provider or national connectivity provider until the legal classification, applicable authorisation and partner agreement are confirmed.

## 2. SIM/eSIM and RICA

The Regulation of Interception of Communications and Provision of Communication-Related Information Act 70 of 2002 (RICA), as amended, establishes requirements relating to interception, communication-related information and service-provider assistance. The South African Government and Department of Justice reported a 26 March 2026 intergovernmental/industry engagement addressing SIM registration weaknesses, eSIM controls and enforcement of existing provisions, with enforcement indicated from 1 July 2026.

Official references:
- RICA Act 70 of 2002: https://www.gov.za/documents/regulation-interception-communications-and-provision-communication-related-information--13
- Department of Justice statement, 26 March 2026: https://www.justice.gov.za/m_statements/2026/20260326-RICA.html

**Required legal and operational questions:**
- Which party is the relevant service provider, licensee, SIM distributor or RICA agent in the proposed arrangement?
- Who performs identity and address verification, validates documents and records the required information?
- What controls prevent bulk, duplicate, false or unverifiable registrations?
- How are SIM/eSIM issuance, replacement, transfer, suspension and cancellation controlled and audited?
- Which party maintains records and fulfils lawful requests under applicable law?
- What technical capabilities, retention periods, security controls and escalation processes are required of each party?
- How do partner systems evidence compliance and handle eSIM-specific lifecycle events?

**Control:** No SIM/eSIM sale, issue, activation or customer onboarding until the responsible parties, RICA process, approved partner workflow, evidence trail and contractual allocation of duties are verified. Do not store identity documents in I-CONNECT merely because a partner process is incomplete.

## 3. Communications interception and lawful process

RICA regulates interception and communication-related information, including obligations affecting telecommunications service providers. Its application must be assessed against the actual service and provider role. The platform must not design covert interception, unauthorised monitoring or informal access to communications.

**Required controls:**
- legal assessment of any statutory service-provider obligations;
- documented lawful-request intake, validation, authorisation and escalation;
- least-privilege access and immutable audit records;
- secure handling, retention and deletion under applicable law;
- separation between customer support, security operations and legally authorised disclosure;
- contractual allocation of responsibilities between IZAKHONO and upstream providers.

## 4. Equipment, spectrum and network operation

ICASA's licensing guidance states that electronic communications equipment and radio apparatus used in connection with electronic communications may require type approval. Network construction, operation, spectrum use and commercial service provision must be classified separately.

Official reference:
- ICASA — Licensing and type approval: https://www.icasa.org.za/pages/licensing

**Control:** No radio equipment deployment, spectrum use, public network construction or commercial network operation without confirming type approval, spectrum rights, site permissions and the relevant ECNS/ECS authorisations.

## 5. POPIA and information security

The Protection of Personal Information Act 4 of 2013 applies to the processing of personal information by public and private bodies. The Information Regulator's guidance identifies security safeguards under sections 19–22, including security measures, operator processing and notification of security compromises.

Official references:
- POPIA Act 4 of 2013: https://www.gov.za/nso/documents/protection-personal-information-act
- Information Regulator — Condition 7 Security Safeguards: https://inforegulator.org.za/knowledge-base/category/popia/chapter-3-conditions-for-lawful-processing/part-a-processing-of-personal-information-in-general/condition-7-security-safeguards/

**Required controls:**
- identify the responsible party and any operators for each data flow;
- document purpose, lawful basis, data categories, recipients, retention and cross-border transfers;
- minimise collection of identity, location, communications and device data;
- execute written operator agreements where required;
- implement appropriate technical and organisational safeguards;
- appoint/confirm the Information Officer and required registrations/processes;
- establish data-subject request, breach response and regulator-notification procedures;
- complete a privacy impact assessment before high-risk location, identity, fleet or emergency workflows.

## 6. Consumer, billing and service obligations

Before customer launch, legal review must cover:
- transparent pricing, bundles, usage limits, expiry and out-of-bundle charges;
- accurate billing, reconciliation, refunds and dispute handling;
- service availability, coverage descriptions, outages and service-level claims;
- complaints and escalation responsibilities between reseller and upstream provider;
- cancellation, number portability and customer-data export where applicable;
- consumer protection, electronic transactions and marketing communications;
- tax, invoicing and recordkeeping.

ICASA identifies consumer protection, service quality, billing and numbering within its telecommunications mandate: https://www.icasa.org.za/pages/telecommunications

## 7. Launch decision checklist

A connectivity pilot is **not ready** until all applicable items have documentary evidence:

| Gate | Required evidence |
|---|---|
| Service classification | Written counsel opinion on ECS/ECNS, exemption/licence and numbering position |
| Upstream provider | Verified licence status, service scope, contract and escalation contacts |
| RICA | Named responsible parties, approved process, audit evidence and tested eSIM lifecycle |
| Lawful process | Counsel-approved responsibilities, request handling and record controls |
| Equipment/network | Type approval, spectrum/site/ECNS permissions where applicable |
| POPIA | Data map, responsible-party/operator roles, privacy notices, contracts and safeguards |
| Customer terms | Pricing, coverage, billing, complaints, cancellation and refund terms |
| Operations | Tested onboarding, activation, support, outage and rollback procedures |
| Economics | Wholesale pricebook, taxes, support cost, working capital and positive/acceptable unit economics |
| Approval | Recorded go/no-go decision by the authorised legal entity |

## 8. Immediate recommendation

Start with a software-only customer account and service-management experience while qualifying authorised upstream providers. Do not activate live SIM/eSIM, voice, numbering or connectivity resale until counsel and ICASA-facing checks establish the correct route for the exact business model.

A partner-first route can reduce infrastructure capital requirements, but it does not automatically remove IZAKHONO's own regulatory, consumer, privacy or contractual responsibilities. The service design and legal role must be assessed before the first customer is accepted.
