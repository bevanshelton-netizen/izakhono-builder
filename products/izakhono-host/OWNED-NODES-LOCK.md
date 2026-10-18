# IZAKHONO OWNED NODES — LOCKED

## Decision

IZAKHONO-owned nodes are the permanent production infrastructure of record.

The platform is **not** designed around a single machine and does **not** require Vercel, Netlify or another hosted runtime.

## Canonical architecture

`IZAKHONO CODE → BUILDER → PROVISIONER → OWNED NODE CLUSTER → OWNED EDGE/TLS → OWNED DNS → FORTRESS → CUSTOMER RUNTIME`

## Execution principle

Build for the owned node fabric first. Deploy the same software across the available IZAKHONO nodes according to their assigned roles. Scale horizontally by adding nodes; do not replace the architecture with a third-party hosting dependency.

## External services

External services are limited to reversible integrations such as domain registrars, payment networks, messaging providers or temporary fallbacks where required. They are never the source of truth for IZAKHONO hosting availability.

## No-machine rule

A machine is an execution target, not an architectural dependency. Losing, replacing or adding a machine must not require redesigning IZAKHONO.

## No false-live rule

The existence of code, a node record or a deployment record does not by itself mean a customer service is publicly LIVE. LIVE requires the acceptance evidence defined by the provisioning state machine.

This document is the architectural lock for the owned-node strategy.
