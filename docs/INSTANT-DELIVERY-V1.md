# IZAKHONO Instant Delivery v1

## Objective

Reduce repeatable project delivery to minutes by pre-provisioning the common path and making every external dependency explicit.

## Definition of ready

A project may enter the instant-delivery path only when these are known:

- source repository
- deployment target
- database target
- application health endpoint
- production domain or approved temporary domain
- fallback route
- authentication dependency
- payment dependency, if any
- email dependency, if any
- backup target

## Standard path

1. Create from the IZAKHONO production template.
2. Register the project in the delivery registry.
3. Attach the existing database/service targets.
4. Populate environment references server-side.
5. Run deterministic preflight.
6. Build.
7. Run application health gate.
8. Deploy.
9. Verify HTTPS/domain.
10. Verify email/payment integrations when applicable.
11. Record evidence.
12. Mark live only after verification.

## Hard rule

A hosting provider's successful deployment is not sufficient evidence of production readiness.

## External blockers

Only external actions that cannot be automated by IZAKHONO should remain manual, including:

- purchasing a new domain
- provider account verification
- banking/KYC/payment-provider approval
- app-store signing/submission
- legal/customer acceptance

Everything else should be handled by the delivery pipeline.

## Recovery

Every production release must retain a previous known-good deployment reference and a database recovery reference before it is promoted.

## Current control-plane location

The operational registry is stored in the IZAKHONO WebStart Supabase project in:

- `izakhono_delivery_projects`
- `izakhono_delivery_services`
- `izakhono_delivery_checks`

No production secret is stored in these tables.
