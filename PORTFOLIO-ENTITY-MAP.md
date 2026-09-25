# IZAKHONO PORTFOLIO ENTITY MAP

## Structural rule

Each operating company keeps its own:

- legal contracts
- bank accounts and settlement accounts
- tax and accounting records
- customer contracts
- customer data controller/processor roles
- subscriptions
- receivables and liabilities
- regulated permissions
- insurance risk
- licences
- financial statements
- audit trail

Shared technology may be supplied by an IZAKHONO infrastructure company under documented intercompany service agreements.

## Shared-service boundaries

The infrastructure layer must tag or isolate all records by `entity_id`.

A service may never infer that two entities can share:
- money
- customers
- balances
- policies
- subscriptions
- files
- secrets
- credentials
- analytics datasets

Cross-entity flows require:
1. explicit business purpose,
2. permitted legal basis,
3. authenticated service-to-service call,
4. audit record,
5. accounting treatment where value moves.

## Regulated businesses

Banking, insurance, credit, investment, payment and broadcasting operations may require different licences, capital, governance and local structures per country.

Technology ownership can be centralised while regulated permissions remain local.


## IZAKHONO Digital Finance Academy

- **Operator:** IZAKHONO AFRICA (PTY) LTD.
- **Product boundary:** Independent IZAKHONO professional-education product.
- **EDU-BUILD boundary:** It is not an EDU-BUILD INSTITUTE – Shelton Campuses programme and must not inherit EDU-BUILD accreditation, qualifications, student records, certificates, payment records or branding.
- **Regulatory claim boundary:** It may teach blockchain, fintech, digital assets, compliance and related subjects, but must not claim university, degree-awarding, accredited-qualification or regulated-advice status unless separately authorised and evidenced.
- **Technology boundary:** It has its own independently deployable product engine. Shared IZAKHONO infrastructure is allowed; dependence on another product engine is not.
