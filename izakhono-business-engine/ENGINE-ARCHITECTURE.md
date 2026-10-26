# IZAKHONO BUSINESS ENGINE™ — V1 Architecture

## Customer flow
1. Business onboarding
2. Workspace creation
3. Growth objective + budget
4. AI growth-plan generation
5. Provisioning handoff
6. Website / domain / forms
7. SEO + paid + social activation
8. CRM + WhatsApp lead routing
9. AI operations and reporting

## API foundation
- `POST /api/onboarding` validates a new business and returns an onboarding workspace record.
- `POST /api/growth-plan` generates a deterministic first-pass growth plan from business, goal and budget.

## Production evolution
The API layer is intentionally provider-neutral. Persistent tenants, authentication, billing, CRM records and automation state should be connected to the IZAKHONO-owned control plane (Supabase/Postgres or the approved owned-first substrate), while external ad/AI providers remain replaceable adapters.

## Commercial principle
The customer buys a connected business-growth outcome, not disconnected agency tasks.
