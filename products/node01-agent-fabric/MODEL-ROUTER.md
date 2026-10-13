# NODE01 v0.8 — Model Router + Agent Intelligence

## Purpose

v0.8 adds a provider-neutral intelligence boundary. Specialist agents can request model reasoning without binding NODE01 to one vendor or API.

## Components

- `model_router.py` — model request/response contracts, capability-aware routing, priority ordering and bounded fallback.
- `DeterministicModel` — offline reference adapter for tests and safe bootstrap operation.
- `intelligence.py` — converts model output into an `AgentDecision` and validates proposed tool calls against the existing fail-closed policy.

## Safety boundary

Model output is a proposal, not an execution command. `AgentIntelligence` does **not** execute tools. Proposed actions must cross the existing task/policy/executor/runtime boundaries.

Destructive proposals are rejected. External or approval-required actions remain gated by policy and explicit authorization.

## Evidence

Every successful routed response receives a deterministic SHA-256 evidence hash covering task, agent, correlation ID, provider, model, content, finish reason and usage.

## Production adapter boundary

The reference adapter is intentionally offline. A production deployment may register approved adapters for selected model providers, subject to credential isolation, network policy, data handling, rate limits, audit logging and owner authorization.

NODE01 must not claim a live provider connection merely because an adapter interface exists. Provider credentials, network reachability and successful production calls require independent evidence.
