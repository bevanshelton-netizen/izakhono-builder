# I-CONNECT Staging Integration Contract

## Purpose
Keep the I-CONNECT staging application isolated from unrelated IZAKHONO Builder workloads while preserving a production-safe boundary.

## Components
- Customer Portal: customer onboarding, product selection and account entry.
- Operations Console: subscriber, activation, payment, provisioning and risk monitoring.
- I-CONNECT Core API: plans, customers, orders, payments, provisioning and health/readiness.
- PostgreSQL: customers, orders, payments, provisioning jobs and audit events.
- Provider adapters: payment, network/MVNO and RICA/compliance contracts.

## Runtime boundary
The staging frontend must communicate with the Core API through a configurable API base URL. No carrier credentials, production payment credentials, RICA credentials or customer secrets are committed to source control.

## Required smoke path
1. GET /health
2. GET /ready
3. GET /api/v1/plans
4. Create customer
5. Create order
6. Submit simulated payment webhook
7. Verify order becomes READY_TO_PROVISION
8. Create provisioning job
9. Verify order enters PROVISIONING
10. Verify audit events when PostgreSQL is enabled

## Release rule
A staging build may be demonstrated as functional only when the smoke path passes. It must not be represented as a live telecom service until Cell C/MVNO onboarding, ICASA regulatory position, production RICA, production payment integration, production network integration and production deployment are independently verified.
