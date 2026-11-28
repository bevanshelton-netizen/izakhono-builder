# IZAKHONO AI — First-Party Intelligence Platform Architecture

**Version:** 1.0  
**Status:** Proposed architecture and implementation baseline; production activation is separately gated  
**Date:** 25 November 2026  
**Owner:** IZAKHONO  
**Repository:** `bevanshelton-netizen/izakhono-builder`

## 1. Executive decision

IZAKHONO AI is the first-party AI assistant and intelligence platform for the IZAKHONO ecosystem. It is the product identity, user experience, API, model gateway, knowledge/memory layer and governed tool interface owned by IZAKHONO.

The objective is to replace ChatGPT as the branded and architectural centre of the IZAKHONO experience. IZAKHONO applications must not require the ChatGPT product or an OpenAI API account to function as their primary assistant. The assistant experience, conversation records, identity, policy, memory, knowledge, tools, model routing and operational evidence belong to IZAKHONO.

This is a real platform transition, not a string replacement or a claim that a new foundation model has already been trained.

**Ownership distinction:** IZAKHONO can own the complete assistant product, serving stack, orchestration, data, policies, evaluation and deployment while initially using lawfully licensed open-weight models. Ownership of an assistant platform is not the same as authorship of every underlying model weight. Training a new foundation model from scratch is a separate research and compute programme, not a prerequisite for launching IZAKHONO AI.

## 2. Product identity and ecosystem relationship

### 2.1 IZAKHONO AI

IZAKHONO AI is the first-party conversational and task-oriented assistant. It provides:

- a branded web and mobile-friendly assistant experience;
- conversation, workspace and file context;
- user- and tenant-scoped memory with provenance and controls;
- retrieval over authorised IZAKHONO and customer knowledge;
- model selection and inference through the IZAKHONO AI Gateway;
- specialist-agent collaboration through the existing NODE01 Agent Fabric;
- governed access to approved product tools and connected systems;
- evidence-linked answers, task status and action receipts;
- multilingual interaction, with language capability validated per model and workflow.

### 2.2 J.A.R.V.I.S.

J.A.R.V.I.S. remains the owner/operator command centre and controlled operations interface. It may embed or invoke IZAKHONO AI, but it is not a competing general-purpose assistant brand and must not become a second model gateway, memory system or agent scheduler.

### 2.3 AI WORKFORCE and NODE01

IZAKHONO AI is the user-facing intelligence product and shared inference/knowledge boundary. AI WORKFORCE defines governed agent identities, ownership and lifecycle. NODE01 Agent Fabric remains the existing orchestration and task-execution coordination layer. FORTRESS remains the authority for identity, policy, approvals, credential access and audit. Runtime Fabric remains responsible for approved workload placement and lifecycle. HOST remains a separately authorised execution boundary.

No new parallel scheduler, agent registry, policy authority or execution fabric is created by this architecture.

## 3. First-party system architecture

```text
People / customers / IZAKHONO operators
                  |
           IZAKHONO AI UX
      conversations / files / voice
                  |
        IZAKHONO AI application API
                  |
      identity, tenant and entitlement
                  |
       FORTRESS policy / approvals
                  |
       IZAKHONO AI Gateway
     model registry / routing / limits
                  |
      +-----------+-------------+
      |                         |
Owned inference runtime    Optional provider adapters
(open-weight models)       (disabled unless approved)
      |
retrieval / memory / knowledge
      |
NODE01 Agent Fabric (bounded plans and tasks)
      |
approved tool proposals / FORTRESS decisions
      |
Runtime Fabric / authorised HOST execution
      |
IZAKHONO products, data and owned infrastructure
      |
audit, evidence, evaluation and observability
```

The diagram is logical. Components must be mapped to existing repository services before implementation. Do not create duplicate services where a canonical implementation already exists.

## 4. Model strategy and ownership ladder

### Stage 0 — working platform without a paid model dependency

Use the existing deterministic offline model adapter for contract tests, local development and safe bootstrap. This proves interfaces and safety behaviour only; it is not a useful general-purpose conversational model and must never be marketed as one.

### Stage 1 — self-hosted open-weight inference

The preferred first real inference target is a lawfully licensed open-weight model served on existing IZAKHONO-controlled hardware, after hardware discovery proves CPU/GPU, RAM/VRAM, storage, cooling, power and throughput suitability.

Requirements:
- record model name, exact version/revision, source, licence and permitted commercial use;
- verify model and tokenizer artifacts and checksums;
- use a replaceable inference-server adapter behind the IZAKHONO AI Gateway;
- bind inference workloads to an approved physical execution environment;
- keep model files, prompts, customer data and logs under IZAKHONO policy;
- measure latency, concurrency, memory use, quality and energy/capacity impact;
- support model unload, rollback and version pinning.

Do not assume a GPU exists. Begin with read-only hardware inspection. If current hardware cannot serve a useful model, document measured constraints and pause or test a smaller quantized model only where capacity and licence permit. Do not buy a GPU, server, VPS or hosted inference subscription without a separate explicit owner decision.

### Stage 2 — IZAKHONO domain intelligence

Add retrieval-augmented generation (RAG) over approved IZAKHONO knowledge, policies, product documentation and tenant-authorised files. Retrieval must preserve source citations, tenant boundaries, freshness and deletion/retention semantics. A model must distinguish retrieved evidence from its own inference and state when evidence is missing.

### Stage 3 — model adaptation

Evaluate prompt engineering, adapters and parameter-efficient fine-tuning (such as LoRA) only where a measurable capability gap exists, the base-model licence permits the intended use, training data rights are established, privacy controls are approved and compute is available. Preserve base-model lineage and reproducible evaluation.

### Stage 4 — IZAKHONO foundation-model research

A model trained from scratch under the IZAKHONO name is a long-term research programme. It requires a lawful, representative dataset, data governance, training compute, specialist staff, evaluation and safety research, energy and operating-cost analysis, model-card documentation and independent testing. It is not claimed as completed or required before the assistant product can launch.

## 5. IZAKHONO AI Gateway

The gateway is the only supported inference entry point for IZAKHONO products and agents.

Responsibilities:
- versioned request/response contracts;
- model and capability registry;
- tenant-aware routing and policy enforcement;
- self-hosted inference as the preferred/default production route;
- bounded context and output limits;
- timeouts, retries, cancellation and concurrency limits;
- deterministic adapter for tests;
- optional external adapters only after explicit owner and tenant approval;
- provider/model provenance on every response;
- usage and resource telemetry;
- prompt-injection and untrusted-content boundaries;
- evidence hashes and trace/correlation identifiers.

Provider adapters must not become the system of record for identity, memory, conversation history, entitlement, customer data or policy. No external provider is a required dependency for normal IZAKHONO AI operation. External adapters remain disabled by default; enabling one requires a recorded decision describing data sent, purpose, region, retention, terms, cost ceiling, fallback behaviour and revocation procedure.

The gateway must fail closed when no approved model route is available. It must not silently send prompts or files to an external API as a fallback.

## 6. Conversation, memory and knowledge

### 6.1 Conversation service

IZAKHONO owns conversation identifiers, messages, attachments metadata, thread state, user controls, retention and export. Store only the content and metadata required for the declared purpose. Encrypt data in transit and at rest, enforce tenant and user boundaries, and avoid copying secrets into prompts or telemetry.

### 6.2 Memory service

Memory is not an unrestricted transcript dump. Each memory item must have:
- owner and tenant scope;
- source/provenance and creation time;
- purpose and confidence;
- sensitivity/classification;
- retention/expiry and correction/deletion lifecycle;
- retrieval policy and audit history.

Users must be able to inspect, correct, export and delete eligible memory. Deletion must propagate to indexes and derived caches according to a documented process. Sensitive information must not be inferred or retained without a lawful purpose and explicit policy.

### 6.3 Knowledge and retrieval

Use a replaceable retrieval pipeline: ingestion, malware/type checks, parsing, chunking, access labels, embeddings, indexing, retrieval, reranking and cited answer construction. Every retrieval result must be filtered by the requesting principal's actual permissions before it reaches a model. A document's text is untrusted content, not an instruction to the assistant or its tools.

Customer knowledge must not be used to train shared models by default. Any cross-tenant learning or training requires separate explicit consent, lawful basis and governance approval.

## 7. Tools, actions and agent safety

Model output is untrusted. A model may produce an answer or a proposed tool call; it cannot grant authority or execute the call itself.

All tool proposals must pass through:
1. schema validation and allowlisted tool registry;
2. authenticated actor and tenant context;
3. FORTRESS policy decision and revocation checks;
4. human approval where required by risk;
5. NODE01 bounded task orchestration;
6. separately verified Runtime Fabric/HOST execution binding;
7. idempotency, timeout and rollback controls;
8. correlated execution receipt and outcome verification.

Read-only retrieval and low-risk drafting may be automated within granted scope. Sending external messages, publishing content, changing DNS, altering permissions, spending money, provisioning infrastructure, deleting data, merging code or deploying production changes require explicit approval and evidence appropriate to their risk. IZAKHONO AI must not approve its own requests.

Prompt injection, retrieved content, uploaded files and tool output must be treated as untrusted. Tool credentials are never placed in model context. Secrets are resolved by the authorised execution service only after policy approval.

## 8. Interface and user experience

The primary experience is branded **IZAKHONO AI**, with:
- a clear assistant identity and model/source transparency;
- conversation list, search, rename and archive;
- file and workspace context with permission-aware retrieval;
- streaming responses where supported by the selected inference runtime;
- citations and evidence panels for retrieved or externally sourced claims;
- visible distinction between answer, recommendation, pending approval and completed action;
- user-controlled memory and data controls;
- responsive mobile and desktop layouts;
- accessible interaction and validated multilingual support.

Voice, image understanding, audio generation and other multimodal features are capability-gated additions. The UI must not display a feature as available unless the selected model/runtime has passed its acceptance tests.

## 9. Security, privacy and governance

- FORTRESS is the sole policy and identity authority.
- Enforce tenant isolation for conversations, memory, files, embeddings, caches, model requests, logs and tool execution.
- Use short-lived service identities and scoped credentials.
- Define data classification, residency, retention, export and deletion.
- Minimise prompt content and redact secrets and unnecessary personal data.
- Keep model/provider access behind network egress policy.
- Record model version, route, policy decision, approvals and execution evidence without logging secrets.
- Apply applicable privacy obligations, including POPIA where relevant.
- Maintain incident response, model rollback, abuse monitoring and vulnerability management.
- Do not claim security certification or legal compliance from architecture or tests alone.

## 10. Evaluation and release gates

A model is not production-approved because it loads or returns text. Each model/runtime combination requires a versioned evaluation suite covering:
- factuality and source-groundedness;
- instruction following and task completion;
- multilingual quality for declared languages;
- refusal and safe handling of disallowed requests;
- prompt-injection resistance and tool-boundary integrity;
- tenant isolation and retrieval authorization;
- latency, concurrency, memory and failure recovery;
- output stability and regression against the prior approved model;
- model licence, provenance and supply-chain integrity.

Production activation requires: inspected and approved owned hardware; verified runtime binding; model licence review; security and privacy review; passing evaluation; monitoring and rollback; backup of required state; explicit owner acceptance. No public assistant launch, external provider connection or paid resource is authorised by this document.

## 11. Phased delivery

**Phase 1 — product contract:** define UI/API, identity, tenant, conversation and evidence contracts; map the existing NODE01 model router and J.A.R.V.I.S. implementation; avoid duplicate gateways.

**Phase 2 — owned hardware readiness:** inspect the existing machine read-only; measure CPU/GPU, memory, storage, network, power and thermal capacity; select only models that fit measured capacity and licence constraints.

**Phase 3 — private inference prototype:** deploy a pinned open-weight model on approved owned hardware in an isolated staging environment; test the gateway and inference adapter without public exposure.

**Phase 4 — assistant experience:** connect IZAKHONO AI UI/API to the gateway, conversation service and permission-aware retrieval; retain J.A.R.V.I.S. as operator command centre.

**Phase 5 — governed workforce:** integrate existing AI WORKFORCE, NODE01, FORTRESS and Runtime Fabric contracts; enable only bounded, evidence-backed tool actions.

**Phase 6 — production readiness:** complete model evaluation, privacy/security review, recovery tests, capacity measurement and owner approval before any public launch.

**Phase 7 — model adaptation/research:** pursue fine-tuning and original model research only with a justified capability gap, rights-cleared data and approved capacity.

## 12. Current implementation facts and gaps

Verified from inspected repository source:
- NODE01 Agent Fabric contains a provider-neutral `ModelRouter` contract with capability-aware adapter selection and bounded fallback.
- A deterministic offline reference adapter exists for tests/bootstrap; it is not a production conversational model.
- Model responses receive a deterministic SHA-256 evidence hash.
- `AgentIntelligence` converts model output into decisions/proposals and does not itself execute tools.
- Existing AI WORKFORCE architecture defines the agent governance, identity, ownership, approval and execution boundaries.
- J.A.R.V.I.S. is an existing owner-facing command-centre product, not proof that the first-party IZAKHONO AI assistant is complete.

Not verified:
- a production self-hosted inference server;
- an approved open-weight model deployed on IZAKHONO hardware;
- hardware capacity for useful inference;
- a complete first-party chat UI/API connected to owned inference;
- production conversation/memory/knowledge services;
- model evaluation and security acceptance;
- public or customer-ready IZAKHONO AI service.

## 13. Non-goals and prohibited shortcuts

- Do not merely rename a ChatGPT integration and call it IZAKHONO AI.
- Do not make ChatGPT or an OpenAI API account a required production dependency.
- Do not silently route user data to an external model provider.
- Do not claim IZAKHONO trained or owns model weights that it has only licensed or downloaded.
- Do not create a second scheduler, agent registry, policy authority or execution fabric.
- Do not expose tools directly to model output.
- Do not buy compute, GPU hardware, model APIs or subscriptions without explicit owner approval.
- Do not claim the assistant is live until the release gates pass.

## 14. Definition of done for the first owned AI release

The first release may be called **IZAKHONO AI — Private Preview** only when an owned-hardware inference runtime, approved model, first-party UI/API, identity and tenant isolation, conversation persistence, permission-aware retrieval, FORTRESS policy integration, model evaluations, audit evidence and recovery procedures have all passed in a named staging environment.

It may be called **IZAKHONO AI — Production** only after separate external acceptance, operational monitoring, support and owner release approval. Source code and passing CI alone are insufficient.
