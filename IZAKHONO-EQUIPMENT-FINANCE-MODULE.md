# IZAKHONO EQUIPMENT FINANCE & INDUSTRIAL SOLUTIONS
## Native IZAKHONO Builder implementation brief

**Parent company:** IZAKHONO AFRICA (PTY) LTD  
**Target host application:** Existing IZAKHONO CRM  
**Builder:** IZAKHONO BUILDER (native, credit-free)  
**Status:** Implementation specification committed; application changes and runtime deployment require separate build/test evidence.

## 1. Product objective

Add an Equipment Finance & Industrial Solutions workspace to the existing IZAKHONO CRM. It must support equipment catalogue management, customer enquiries, quotations, finance-provider referrals, pipeline tracking, supplier settlement, installation/commissioning and after-sales follow-up.

Do not create a disconnected CRM or depend on Hercules, paid builder credits, hosted AI credits or a per-build meter. Use native Builder planning, scaffolding, validation, security checks, packaging and the Software NODE/runtime path.

## 2. Business boundaries

IZAKHONO acts as equipment supplier/integrator and customer relationship coordinator. An independently authorised finance provider performs affordability/credit assessment, makes the lending decision, contracts with the customer and disburses funds.

The platform must never:
- represent IZAKHONO as a lender unless separately authorised;
- promise finance approval or quote unverified repayments;
- make credit decisions or run bureau checks;
- collect identity documents, bank statements or credit reports in the public enquiry form;
- transmit sensitive documents to a provider without an approved, secure, consented provider workflow;
- record a referral commission as earned without a signed agreement and satisfied payment trigger.

## 3. Workspace navigation

1. Overview dashboard
2. Equipment catalogue
3. Customer enquiries
4. Quotations and packages
5. Finance pipeline
6. Finance partners
7. Supplier register
8. Deliveries and installations
9. Maintenance / after-sales
10. Commission ledger
11. Reports
12. Audit and settings

## 4. Core records

### Equipment
- id, SKU, title, category, description, manufacturer, model
- condition (new / refurbished / used)
- supplier_id, supplier_quote_reference
- specifications, warranty, lead_time_days
- cost_price (restricted), selling_price, currency
- availability_status, image_refs, created_at, updated_at

### Customer enquiry
- id, business_name, registration_number_optional
- contact_name, email, phone, province, city
- industry, equipment_category, requirements
- budget_min, budget_max, condition_preference
- installation_required, training_required
- consent_text_version, consent_timestamp
- assigned_to, status, created_at

Public intake must not request ID number, bank statements, payslips, credit reports or online banking credentials.

### Quotation
- id, enquiry_id, quote_number, valid_until, currency
- line_items (equipment/service, quantity, unit_price, tax)
- delivery_fee, installation_fee, training_fee, total
- supplier_cost and margin are internal-only fields
- terms, exclusions, status, approved_by, issued_at

### Finance partner
- id, trading_name, legal_entity_name, actual_lender
- contact_person, email, phone, website
- NCR/FSP identifiers and verification evidence
- asset_categories, new_used_eligibility, min_amount, max_amount
- terms, deposit_rules, fees, commission_terms
- supplier_settlement_trigger, agreement_reference
- due_diligence_status (prospect / in_review / verified / rejected)
- last_contact_at, notes

Existing outreach targets must initially be marked **PROSPECT — OUTREACH SENT**, never approved/verified by default.

### Finance referral
- id, enquiry_id, quotation_id, partner_id
- customer_consent_reference, referral_date
- provider_reference, provider_status
- approval_amount (provider-confirmed only), agreement_date
- supplier_settlement_status, settlement_date, settlement_reference
- outcome, next_action_at, owner_id

### Installation / service job
- id, enquiry_id, equipment_ids, delivery_date
- acceptance_evidence, installation_required, installation_date
- commissioning_checklist, training_completed
- warranty_start, warranty_end, service_due_date
- job_status, assigned_technician, customer_signoff

### Commission ledger
- id, partner_id, referral_id, agreement_reference
- expected_amount, earned_amount, invoiced_amount, paid_amount
- earned_trigger_evidence, invoice_reference, paid_at, status
- Never assume a commission rate. Populate only from an executed written agreement.

## 5. Pipeline

NEW ENQUIRY → QUALIFICATION → QUOTATION PREPARATION → QUOTATION ISSUED → CUSTOMER ACCEPTANCE → CONSENT TO REFERRAL → PROVIDER REFERRED → PROVIDER ASSESSMENT → APPROVED / DECLINED / WITHDRAWN → AGREEMENT SIGNED → DELIVERY → CUSTOMER ACCEPTANCE → SUPPLIER SETTLEMENT VERIFIED → INSTALLATION / COMMISSIONING → AFTER-SALES → CLOSED.

Each transition records actor, timestamp, previous state, new state and optional evidence. Provider assessment and approval statuses must be provider-confirmed, not inferred by IZAKHONO staff.

## 6. Roles and permissions

- Owner/Admin: all settings, partner verification, role assignment, audit access.
- Finance Desk: enquiries, quotations, referrals, partner records, pipeline; no unrestricted secrets access.
- Sales: customer enquiries, catalogue and quotations; no supplier cost, margin or commission ledger.
- Operations: delivery, installation, acceptance and service jobs.
- Management: read-only dashboard and reports.
- Customer: own enquiry and quotation status only, where authenticated customer access is implemented.

Enforce authorization server-side and tenant/customer record scoping. Hiding a UI control is not an authorization boundary.

## 7. Dashboard metrics

Show counts and values separately for:
- enquiries received and qualified;
- quotations issued and accepted;
- referrals submitted;
- provider-confirmed approvals and declines;
- equipment sales value;
- deliveries and installations completed;
- supplier settlements verified;
- commissions expected, earned, invoiced and paid.

Do not mix quoted pipeline value with realised revenue. Clearly label estimates and provider-confirmed figures.

## 8. Customer-facing disclosures

Display this wording wherever finance is mentioned:

“Finance is provided by an independent finance provider and is subject to that provider’s assessment, terms and approval. IZAKHONO AFRICA (PTY) LTD does not guarantee finance approval. Any indicative figures are illustrative only and are not an offer of credit.”

Do not display monthly instalments until a named provider supplies a current, supportable quotation with all assumptions, fees, deposit and term stated.

## 9. Security, privacy and audit

- POPIA-conscious purpose limitation, notice and consent.
- Collect only information necessary for the current stage.
- Secure provider document handoff only after due diligence and explicit customer consent.
- Role-based access, audit trail, access logging and retention/deletion controls.
- Secrets stay server-side; no credentials in client bundles or source control.
- Protect against IDOR, privilege escalation, injection, CSRF and insecure file upload.
- Record consent wording version and timestamp.
- Do not integrate credit bureaus, lender APIs, payment collection or automated document transfer until contracts, lawful basis, credentials and security review are complete.

## 10. Initial equipment catalogue categories

- Industrial sewing and overlock machinery
- Embroidery machines
- Sublimation printers and heat presses
- Fabric cutting and finishing equipment
- Furniture manufacturing machinery
- Printing and branding equipment
- Agricultural and commercial machinery
- Complete factory setup and installation packages

No placeholder price is customer-publishable. Every published price must trace to a current supplier quotation and approved Izakhono selling price. Keep cost and margin fields staff-only.

## 11. Native Builder execution plan

1. Inspect existing CRM architecture, auth model, database schema, UI conventions and tests before changing code.
2. Identify reusable CRM customer, lead, task, quotation, audit and role primitives. Extend rather than duplicate.
3. Add schema/migrations with indexes, foreign keys, constraints and audit events.
4. Add server-side authorization and validation before UI.
5. Implement catalogue, enquiry intake, quotation workflow and pipeline.
6. Implement partner due-diligence register and commission ledger.
7. Implement delivery, installation and after-sales records.
8. Add dashboard metrics and reports with clear financial definitions.
9. Add seeded demo data clearly marked non-production; no fake approved partners or finance offers.
10. Run unit, integration, authorization, privacy, migration and end-to-end tests.
11. Produce build artifact, test report, security findings and release identity.
12. Deploy only through the IZAKHONO owned-first Runtime Fabric after health, backup, restore, DNS/TLS and rollback gates pass. Keep any verified external route intact until owned cutover is proven.

## 12. Acceptance criteria

- Existing CRM functions continue to work.
- No duplicate customer/lead identity is created when an existing CRM record can be linked.
- Every enquiry and referral has an auditable status history.
- Staff cannot access restricted cost/margin/commission fields without permission.
- Customers cannot view another customer's records.
- Finance partner prospect status cannot be mistaken for verified approval.
- Public enquiry does not collect sensitive credit documents.
- No unverified repayment, approval, commission or supplier settlement is represented as fact.
- All workflow transitions have tests and evidence.
- No public-live claim without a verified route and end-to-end acceptance evidence.

## 13. Existing outreach prospects

The following organisations have received initial partnership enquiries and must remain prospect records pending verification and written responses:
- Unified Business Solutions
- Centrafin
- CorpRent Leasing
- Sunstone Asset Finance
- Compass Finance

The initial outreach is not evidence of appointment, authorisation, approval, agreed commission or partnership.
