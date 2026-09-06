# IZAKHONO OPENAI INDEPENDENCE STANDARD

## Decision

IZAKHONO products must not require OpenAI-hosted inference, OpenAI API credentials, OpenAI SDKs, OpenAI domains, or ChatGPT product dependencies in order to operate.

This applies to all operating entities using the shared IZAKHONO technology stack.

## What this means

- no required `api.openai.com` calls
- no required OpenAI API keys
- no `openai` package as a runtime dependency
- no product feature may become unavailable merely because an OpenAI account, subscription, usage quota, billing account or service is unavailable
- user identity, subscriptions, conversations, files and business records remain under IZAKHONO-controlled contracts
- AI inference defaults to owner-controlled model runtimes through IZAKHONO AI GATEWAY
- model backends remain replaceable without changing product applications

## Brand rule

IZAKHONO products must use IZAKHONO product names and must not imply they are ChatGPT or an OpenAI model.

## Current owner-AI path

IZAKHONO INTELLIGENCE -> IZAKHONO ID -> IZAKHONO ACCESS -> IZAKHONO AI GATEWAY -> owner-controlled model runtime

## Remaining autonomy work

Full independence still requires proving the runtime, storage, network edge, secrets, observability and backup layers on owner-controlled infrastructure.

Using this ChatGPT conversation to help build software does not make the resulting IZAKHONO runtime dependent on OpenAI.
