# IZAKHONO Autonomous Business Engine — Backend Contract

The UI is backed by the shared IZAKHONO Supabase project. The engine persistence layer is now established with three core tables:

- `abe_runs` — one autonomous business run and its current stage/status.
- `abe_tasks` — specialist-agent work items for Research, Product, Revenue and Operations.
- `abe_events` — immutable execution/event history.

## Execution flow

`Founder idea → Run → CEO Orchestrator → specialist tasks → events → stage progression → operating loop`

The intended first orchestration payload is:

```json
{
  "idea": "Founder business idea",
  "agents": ["Research", "Product", "Revenue", "Operations"]
}
```

## Current infrastructure state

The database layer is provisioned. A dedicated Supabase Edge Function was attempted but the project has reached its configured maximum number of Edge Functions, so no existing production function was overwritten or repurposed. The next implementation step is to attach the orchestrator to the existing IZAKHONO gateway/command infrastructure or provision an owned runtime function slot.

The Vercel presentation deployment remains unchanged.
