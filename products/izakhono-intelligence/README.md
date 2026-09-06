# IZAKHONO INTELLIGENCE 10

IZAKHONO's owner-controlled AI product layer.

This is **not OpenAI's proprietary ChatGPT software and does not claim to be a future OpenAI model**. "10" is the IZAKHONO product generation name. The goal is to deliver a ChatGPT-class user experience while keeping identity, subscriptions, conversations, model routing and business data behind IZAKHONO-owned platform contracts.

## Built now

- branded web chat workspace
- IZAKHONO ID session introspection
- hard entity-scoped conversation storage
- IZAKHONO ACCESS enforcement through the AI Gateway
- owner-model routing through IZAKHONO AI GATEWAY
- persistent conversations
- deterministic calculator tool
- no artificial per-message or per-session credit meter for active subscribers
- replaceable model backend contract

## Architecture

User -> IZAKHONO INTELLIGENCE 10 -> IZAKHONO ID -> IZAKHONO ACCESS -> IZAKHONO AI GATEWAY -> owner model pool

Every conversation is stored with both `entity_id` and `subject`. A session belonging to one operating entity cannot read another entity's conversations.

## Capability roadmap

The same product shell will gain, behind IZAKHONO-owned interfaces:

1. file/document workspace
2. web research and source citations
3. vision/image understanding
4. voice
5. image generation
6. code execution and sandboxes
7. app/plugin connectors
8. multi-step agents
9. user-approved actions
10. entity-scoped memory and knowledge
11. model pools and GPU scheduling
12. mobile/desktop clients

## Subscription promise

Where an IZAKHONO entity sells an unlimited plan, active subscribers do not receive an additional hidden message-credit counter. Fair-use, safety, abuse prevention and real compute/storage/network limits still apply.

## Production gates

This alpha must not be called public production-ready until IZAKHONO ID gains hardened MFA/recovery/device controls, ACCESS is deployed with entity-scoped production storage, EDGE provides TLS/rate limiting, VAULT manages secrets, and OBSERVE provides audit/uptime evidence.
