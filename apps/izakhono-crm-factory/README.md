# IZAKHONO CRM FACTORY

Owned-first CRM builder for IZAKHONO internal businesses.

## Mission
Build one reusable CRM engine and provision multiple business-specific workspaces without paying for a separate CRM platform for each company.

## Factory templates
- General Business
- Sales
- Education
- Manufacturing
- Services

## Multi-tenant core — Build 2
The CRM Factory now has a persistent multi-tenant data model backed by the existing IZAKHONO WebStart Supabase project:

- `crm_workspaces` — isolated business CRM instances
- `crm_workspace_members` — owner/admin/manager/member/viewer roles
- `crm_companies` — company accounts
- `crm_contacts` — people and leads
- `crm_pipeline_stages` — reusable sales stages
- `crm_deals` — pipeline opportunities and revenue values
- `crm_tasks` — follow-ups and execution
- `crm_activities` — calls, emails, meetings, WhatsApp and notes
- `crm_provision_workspace()` — one-call workspace provisioning with default stages

Tenant isolation is enforced with Postgres Row Level Security. Workspace membership is the authorization boundary; the application should never rely on frontend filtering as its security boundary.

## Provisioning flow
1. User signs in.
2. Selects **+ CREATE NEW CRM**.
3. Chooses a business template.
4. Enters business name and workspace slug.
5. Factory provisions the workspace, owner membership and default pipeline.
6. Workspace opens with Contacts, Companies, Pipeline, Tasks and Activity modules.
7. Future connectors attach payments, WhatsApp, email, AI Sales Engine and IZAKHONO Provisioner without changing the tenant model.

## Roadmap
1. ~~Workspace provisioning foundation~~
2. ~~Persistent multi-tenant schema~~
3. ~~Role-based tenant isolation~~
4. Contacts / companies / leads UI
5. Pipeline and deal UI
6. Tasks and follow-ups UI
7. Quotes, orders and payments
8. AI Sales Assistant / AI Income Engine
9. WhatsApp and email connectors
10. CRM template editor
11. IZAKHONO Provisioner integration
12. Commercial CRM Factory packaging

## Operating principle
**Build once. Reuse everywhere. Own the business logic. Keep external infrastructure replaceable.**

## Security note
The CRM tables use Supabase Auth + Postgres RLS. Do not expose service-role credentials to the browser. All future browser-accessible CRM tables must remain protected by RLS.
