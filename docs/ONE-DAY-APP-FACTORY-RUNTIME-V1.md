# IZAKHONO One-Day App Factory Runtime v1

The factory is now an executable orchestration contract rather than a marketing diagram.

## Execution path

`brief → intake → plan → AI route → build → security → QA → package → deploy → revenue`

The runtime is deliberately fail-closed. It can prepare and validate work without granting an AI model permission to publish, charge, overwrite infrastructure, or claim that an application is live.

## AI routing

`tools/izakhono_factory_runtime.py` uses the existing Free-First LLM router. Provider keys are checked server-side through environment variables; the planner never emits secret values. The route contains a selected provider plus ordered fallbacks.

## Promotion gates

Deployment requires:

- owner authorization;
- security gate passed;
- QA gate passed;
- artifact verification.

Revenue activation additionally requires deployment evidence and a verified revenue path.

`public_live` remains false until deployment evidence exists.

## Worker boundary

The runtime contract is intentionally separate from provider-specific side effects. GitHub, Vercel, Cloudflare, payment, DNS, email and other integrations should be implemented as typed workers that return evidence records. A failed worker must not be converted into a successful stage by the model.

This preserves the IZAKHONO owned-first rule: the orchestration layer owns the workflow, while external providers are replaceable adapters.

## Local smoke test

```bash
PYTHONPATH=tools python tools/izakhono_factory_runtime.py "Build a customer web app"
PYTHONPATH=tools python -m pytest tests/test_factory_runtime.py
```

The core planner does not require an external AI provider to produce a deterministic execution plan.
