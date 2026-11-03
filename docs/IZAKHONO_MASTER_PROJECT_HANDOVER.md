# IZAKHONO MASTER PROJECT HANDOVER

**Source:** ChatGPT working context and project history available to Bevan Shelton
**Destination:** IZAKHONO AI / IZAKHONO Builder
**Purpose:** Establish a canonical operating context so IZAKHONO can become the primary AI assistant and execution layer for the user's projects.

> IMPORTANT: This is a knowledge/context handover, not a transfer of ChatGPT's private internal model weights, hidden chain-of-thought, proprietary system prompts, or account credentials. IZAKHONO must implement its own reasoning/orchestration layer and may use external models as replaceable intelligence providers.

## 1. PRIMARY OPERATING DIRECTIVE

IZAKHONO is intended to become the user's primary AI operating system and execution partner. The user should be able to converse naturally with IZAKHONO, give instructions, ask questions, request research, create documents, build software, manage projects, troubleshoot systems, and initiate business workflows without manually orchestrating tools.

Core principle:

**Talk to IZAKHONO. Give it a job. IZAKHONO understands, plans, acts, verifies, remembers, and reports.**

External AI providers are fallback/intelligence providers, not the customer relationship layer. Model providers must remain replaceable.

## 2. REQUIRED IZAKHONO BEHAVIOUR

IZAKHONO should emulate the useful observable capabilities of a high-end ChatGPT-style assistant:

- natural multi-turn conversation
- persistent conversation context
- project and business memory
- web research
- document/file understanding
- coding and code generation
- code execution in controlled environments
- database operations
- GitHub/repository operations
- website/application construction
- deployment workflows
- business research and planning
- specialized agents
- tool selection
- multi-step execution
- error detection and recovery
- testing and verification
- autonomous long-running jobs
- permissions and approvals
- audit trails
- model routing and fallback

Do NOT attempt to reproduce private reasoning traces. Store concise decisions, plans, tool actions, results, errors and verification evidence instead.

## 3. CORE ARCHITECTURE

YOU
→ IZAKHONO CHAT
→ IZAKHONO BRAIN
→ IZAKHONO MEMORY
→ AGENT ORCHESTRATOR
→ ACTION ENGINE
→ SPECIALIZED AGENTS
→ TOOLS / APIS / INFRASTRUCTURE
→ VERIFICATION
→ RESULT

Required major services:

1. IZAKHONO CHAT — conversational interface.
2. IZAKHONO BRAIN — model routing, planning, reasoning and context assembly.
3. IZAKHONO MEMORY — user, company, project, customer, document and decision memory.
4. IZAKHONO ACTION ENGINE — executes real-world tool actions.
5. IZAKHONO WORKER — long-running/background jobs and autonomous workflows.
6. IZAKHONO CONTROL PLANE — identity, permissions, billing, audit, secrets and policy.
7. IZAKHONO INFRASTRUCTURE — owned-first infrastructure with reversible external fallbacks.

## 4. EXECUTION STATE MACHINE

Every meaningful task must have explicit state:

PLANNED → BUILDING → TESTING → FAILED/RETRYING → VERIFIED → DEPLOYED

IZAKHONO must never report “done” merely because content/code was generated. It must distinguish generated, tested, verified and deployed states.

## 5. OWNED-FIRST INFRASTRUCTURE RULE

Use IZAKHONO-owned infrastructure first wherever practical. External providers may be used as fallbacks, but integrations must be abstracted so they can be replaced later.

Relevant existing concepts:
- Izakhono Code
- Izakhono Cloud
- FORTRESS
- IZAKHONO PROVISIONER
- IZAKHONO Builder
- owned hosting / Hostinger/Xneelo-equivalent ambition

Do not claim production status without verification.

## 6. EXISTING TECHNICAL ECOSYSTEM

Known/usable technology relationships include:
- GitHub for source repositories
- Supabase for database/auth/backend capabilities
- Vercel for initial web deployment where useful
- external AI providers through a model-router abstraction
- payment providers including iKhokha and PayFast where already selected for particular products
- domain/DNS/email/SSL infrastructure
- browser/web research and automation tools

Architecture must remain portable to IZAKHONO-owned infrastructure.

## 7. PRIMARY KILLER WORKFLOW

The first flagship autonomous workflow should be website/application provisioning.

Example instruction:

“IZAKHONO, build me a website for X.”

Expected behaviour:
1. Understand business and requirements.
2. Create project specification.
3. Create project/repository.
4. Generate application.
5. Configure database where required.
6. Run tests.
7. Diagnose and fix errors.
8. Deploy.
9. Inspect deployment.
10. Configure domain/DNS/SSL where authorized.
11. Provision business email where authorized.
12. Connect CRM, forms, WhatsApp and payment links where required.
13. Verify.
14. Provide status and access details.
15. Store the project in IZAKHONO MEMORY.

## 8. IZAKHONO PROVISIONER

Long-term provisioning target:

PAYMENT VERIFIED
→ DOMAIN REGISTRATION
→ DNS
→ WEBSITE FROM TEMPLATE
→ BUSINESS EMAIL
→ SSL/TLS
→ CRM
→ WHATSAPP
→ FORMS
→ PAYMENT LINKS
→ CUSTOMER LOGIN
→ HANDOVER

The goal is one orchestrated workflow rather than dozens of manual infrastructure steps.

## 9. BUSINESS / COMPANY PORTFOLIO

### IZAKHONO AFRICA (Pty) Ltd — umbrella business / holding structure

Core manufacturing business. Intended umbrella positioning for the wider ecosystem.

Primary capabilities:
- clothing manufacturing
- uniforms
- Matric jackets
- PPE
- sportswear
- corporate apparel
- furniture through Classique Furniture

Known accreditation/qualification context includes FP&M SETA accreditation for relevant clothing, leather and upholstery activities.

### CLASSIQUE FURNITURE

Furniture manufacturing/business initiative under the wider IZAKHONO ecosystem.

Known equipment planning figure: approximately R1.25M for furniture equipment.

### BEVAN SHELTON

Urban clothing brand established in 1994.

Product direction includes:
- tracksuits
- hoodies
- jackets
- African heritage-inspired apparel
- sizes extending to 8XL in relevant product ranges

### EDU-BUILD INSTITUTE SHELTON CAMPUSES

ECD teacher-training institution.

Known programmes:
- NQF Level 4 — 140 credits, approximately 12 months, previously priced at R13,000
- NQF Level 5 — 240 credits, approximately 18 months, previously priced at R15,000
- Inclusive Education NQF Level 5

Known campus locations:
- Gqeberha / Bethelsdorp
- Graaff-Reinet
- Cradock
- Mthatha
- Dimbaza
- Butterworth
- East London
- Queenstown

Brand palette previously specified:
- Turquoise Green
- Turquoise Blue
- Gold
- Sky Blue

Website previously referenced: www.edubuildshelton.org.za

### KORA NETWORK

African media, storytelling, visibility, market-access and ecosystem platform.

All IZAKHONO Africa initiatives are intended to be able to gain visibility through KORA while KORA remains distinct from manufacturing operations.

Known initiatives:
- KORA Learner Driver SA campaign/page
- KORA Kids Studio concepts
- funding outreach
- commercial partnerships

Known issue from prior work: production work has encountered external deployment/resource limitations. IZAKHONO should design around provider lock-in and infrastructure bottlenecks.

### I-CONNECT

Customer-facing telecom/connectivity product name. Use **I-CONNECT** rather than “IZAKHONO CONNECT”.

Strategic direction: IZAKHONO-owned connectivity/telecom brand with external network infrastructure where necessary until owned infrastructure is viable.

### IZAKHONO NAV

Safety-first navigation and mobility platform.

Product pillars:
1. Driver Safety Guardian
2. Emergency & Hijacking Response
3. AI Driver Companion
4. World-Class Navigation
5. Safe Sports Audio
6. Vehicle Intelligence
7. African Road Intelligence
8. Fleet & CIT Security
9. Offline/low-connectivity resilience
10. FORTRESS Security Integration

Commercial progression:
Consumer NAV → Fleet NAV → Secure Fleet → CIT → Enterprise Security → Government/Emergency Mobility

Core principle:
**EVERY JOURNEY SHOULD BE SAFER BECAUSE IZAKHONO NAV IS PRESENT.**

### FORTRESS

Security/infrastructure concept intended to integrate with IZAKHONO platforms, including IZAKHONO NAV and the broader control plane.

### IZAKHONO BUILDER

Existing GitHub repository:
`bevanshelton-netizen/izakhono-builder`

This repository is the natural home for the autonomous builder/orchestration evolution and now contains this master handover document.

### IZAKHONO AI

Primary AI assistant / operating system initiative.

Target experience:
- ChatGPT-like conversational experience
- project memory
- tool execution
- autonomous building
- research
- business operations
- persistent context
- verification
- model fallback

External AI becomes replaceable infrastructure rather than the customer-facing identity.

## 10. DIAMOND / INDUSTRIAL / OTHER BUSINESS INITIATIVES

### Diamond Beneficiation Training Centre

Concept tied to existing diamond-related qualifications and industry experience. Treat as an active business initiative requiring future specification, funding model and implementation plan.

### KG INDUSTRIAL

Ship-repair initiative associated with East London Harbour.

### FREE BIRD AGRI-QUIP

Poultry/egg-layer farming initiative.

### SHELTONAIR

Airline business-plan concept.

### SHELTON CARS

Automotive business/product concept.

## 11. MEDIA / MUSIC / CREATIVE PROJECTS

### ALLEGRO VIBEZ / ALLEGRO

Music/media initiative. Radio/audio concepts have been associated with Allegro.

IMPORTANT: **THE VOICE COMMUNITY ONLINE RADIO is ABORTED and must not be treated as a current project unless explicitly reinstated by the user.**

## 12. MUSIC BUSINESS / BOOK PROJECT

### THE BUSINESS OF MUSIC

Internationally oriented book/manual about the music business.

Previously discussed international ebook retail price: US$7.99.

South African edition has also been marketed in prior work, with a current automation tracking confirmed sales at the previously defined South African price point.

## 13. BOOK / MANUSCRIPT PORTFOLIO

### FAITH PERSONIFIED — MY JOURNEY

Christian marriage manual / personal journey.

Related title concept:
**A RING DOESN’T MARRY YOU… COVENANT DOES!**

Locked writing requirements for this project family:
- genuine substantial book, approximately 200–250+ pages where specified
- practical help, not padding
- conversational user voice
- South African context where relevant
- NKJV Scripture quotations
- Scripture quotations/passages in bold italics with biblical references
- fully developed paragraphs
- avoid stacked declarations, slogan chains, artificial paragraph breaks and sermon cadence
- thoughtful explanations, examples and transitions

### FIX ME AND I’LL FIX IT!!!

Healing-focused book project.

Core reader-outcome requirement:
The book must genuinely help readers move toward healing, clarity, renewed hope and practical change.

Scripture formatting rule:
All Scripture quotations and Scripture passages must be bold italics with biblical reference.

### LET US GO BACK TO CHURCH

Target manuscript approximately 220 pages.

Locked style:
- fully developed paragraphs
- no one/two-line paragraph padding
- no stacked declarations
- no slogan chains
- no artificial paragraph breaks
- no repetitive rhetorical questions
- no sermon cadence
- substantial chapters
- Scripture and concrete life examples integrated naturally

## 14. DSAC / UBUNTU FOLK CLUSTER

### Ubuntu Folk Creativity Economics of South Africa

User has served as National Chair / Chairperson of the Folk Music Board.

DSAC cluster governance and funding work has included:
- first tranche of approximately R1.2M against TOR allocation of approximately R2M
- reported spending reconciliation approximately R1,052,785.68
- provincial activations across EC, WC, FS and GP
- governance/mobilisation
- infrastructure
- travel
- branding

A proposed Three-Day Skills Transfer & Arts Showcase Programme pilot in Soweto was previously estimated at approximately R442k, with possible cluster contributions around R30k each.

IZAKHONO should preserve the distinction between confirmed financial facts and proposals/estimates.

## 15. FAISREADY

Compliance/training platform concept.

Known product pricing:
- RE5 — R299
- RE1 + RE5 bundle — R549
- RE1 — R399

Payment integration history includes iKhokha links.

## 16. PLATFORM / INFRASTRUCTURE DIRECTIVES

1. Owned-first.
2. Externally reversible.
3. Never lock core business logic into a vendor.
4. Preserve verified fallbacks.
5. Separate business logic from infrastructure problems.
6. Automate provisioning.
7. Prefer one-click workflows.
8. Do not require the user to manually execute dozens of technical steps.
9. Never claim “live”, “launched”, “deployed” or “verified” without evidence.
10. Record deployment URLs, commit IDs, test results and verification evidence when available.

## 17. CUSTOMER / COMMERCIAL PRINCIPLES

IZAKHONO software/AI products should favour predictable flat-rate pricing rather than per-use AI credits.

Customer-facing model:
- simple plans
- predictable monthly/annual pricing
- AI capabilities included within plan limits
- IZAKHONO controls the orchestration layer
- customers should not need to understand which underlying model/provider is being used

## 18. SECURITY MODEL

Never give an AI agent unrestricted production credentials.

Use:
- scoped service accounts
- least privilege
- secret vaulting
- approval gates for destructive actions
- audit logs
- sandboxed code execution
- environment separation
- deployment verification
- rollback mechanisms

## 19. CURRENT AUTOMATIONS / MONITORING CONTEXT

Known scheduled workflows include:
- KORA funding reply monitoring
- KORA funding follow-up monitoring
- THE BUSINESS OF MUSIC sales threshold monitoring

IZAKHONO should eventually absorb or replace these workflows through its own worker/automation engine.

## 20. PRIORITY ORDER FOR IZAKHONO

### P0 — IZAKHONO AI CORE
Build the conversational interface and orchestration layer.

### P1 — MEMORY
Persist:
- user profile/preferences
- companies
- projects
- project status
- decisions
- documents
- customers
- credentials references (never raw secrets)
- goals
- outstanding tasks

### P1 — ACTION ENGINE
Connect:
- GitHub
- Supabase
- web research
- filesystem
- code execution
- deployment
- documents
- email
- payments
- domain/DNS services

### P1 — AUTONOMOUS BUILDER
Make “build this” result in actual project creation, testing, fixing and verification.

### P2 — PROVISIONER
Automate website/domain/email/SSL/CRM/payment provisioning.

### P2 — MODEL ROUTER
Allow multiple external AI models plus future IZAKHONO-owned models.

### P2 — WORKER / JOB ENGINE
Support tasks that continue after the user sends the instruction.

### P3 — OWNED INFRASTRUCTURE MIGRATION
Move critical components from external platforms to IZAKHONO infrastructure as capacity becomes available.

## 21. FIRST FLAGSHIP USER EXPERIENCE

User says:

“IZAKHONO, build me a website for my new business.”

IZAKHONO responds conversationally, determines missing requirements, creates the project, executes the work, shows progress, handles errors, verifies the result and returns the outcome.

The user should not have to say “next” after every step.

## 22. HANDOVER RULE

From this document onward, IZAKHONO should treat the project portfolio as persistent operating context.

When a project is mentioned:
- locate its project record
- retrieve relevant history
- identify current state
- continue from the latest verified state
- do not restart unnecessarily
- do not ask the user to repeat known context
- only ask for genuinely missing information or authorization

## 23. FINAL PRINCIPLE

**YOU DON'T LEARN HOW IZAKHONO WORKS. YOU SIMPLY TALK TO IZAKHONO.**

The objective is not merely to build another chatbot.

The objective is to build an AI operating system that can understand the user's businesses, remember their projects, use tools, build software, perform research, automate operations, provision infrastructure, verify results and continuously move the work forward.

**IZAKHONO AI = YOUR AI. YOUR INFRASTRUCTURE. YOUR OPERATING SYSTEM.**
