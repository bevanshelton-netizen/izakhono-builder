# MiroFish exploration - 27 September 2026

## What it is

MiroFish is an open-source multi-agent scenario simulation / prediction engine. Its public workflow is broadly:

1. ingest reality-seed material such as reports, PDFs or notes;
2. extract entities and relationships into a graph;
3. create many agent personas;
4. run several rounds of agent interaction;
5. generate a structured report and allow deeper interrogation of the simulated world.

Original public repository:
https://github.com/666ghj/MiroFish

CLI-oriented fork:
https://github.com/SCTY-Inc/mirofish-cli

## Why it is relevant to IZAKHONO

The useful product pattern is structured decision rehearsal, not magic prediction:

- stress-test a price change before launch;
- compare reactions from customers, staff, suppliers, regulators and competitors;
- surface objections and second-order effects;
- expose assumptions that need real evidence;
- produce questions and experiments before money is committed.

This pattern can become an IZAKHONO Decision Lab used across BUSINESS AI, FORTRESS, product launches, marketing, pricing and partnership proposals.

## Licensing boundary

The original MiroFish repository declares AGPL-3.0. That licence can create source-disclosure obligations for network use of covered code. IZAKHONO therefore should not copy, fork or embed its code inside a proprietary closed product without a deliberate legal/licensing decision.

Current implementation choice: clean-room original Decision Lab. We learn from the public product pattern, but write our own code and architecture.

## IZAKHONO Decision Lab roadmap

### v0.1 - built now
- scenario statement
- stakeholder list
- time horizon
- independent perspective cards
- tensions, risks and next evidence to collect
- explicit simulation-not-certainty disclosure

### v0.2
- source-packet upload
- entity and relationship extraction
- evidence graph
- role/persona generator
- 3-10 reaction rounds
- disagreement and consensus clustering
- immutable simulation manifest
- report export

### v0.3
- multi-run comparison
- alternative intervention testing
- confidence ranges tied to evidence quality
- red-team agents
- sector packs for retail, finance, education, media and public-sector procurement

### Guardrails
- never present a synthetic simulation as real-world evidence;
- never claim certainty or guaranteed prediction;
- separate facts, assumptions and simulated reactions;
- retain source provenance for evidence-backed runs;
- do not use private customer data outside the user's chosen workspace or adapter.


## Fresh review — 27 September 2026

A fresh review of the original MiroFish repository and active forks confirms several implementation ideas worth studying independently:

- graph building from uploaded seed material, including entity/relationship extraction and memory injection;
- automated persona generation and environment setup;
- multiple rounds of agent interaction rather than a one-shot answer;
- temporal memory updates during the simulation;
- a dedicated report agent that interrogates post-simulation state;
- deep interaction with individual simulated agents after the main run;
- machine-readable verdict/report output in CLI-oriented forks;
- local/self-hosted graph-storage variants in some forks.

Public references reviewed:
- https://github.com/666ghj/MiroFish
- https://github.com/SCTY-Inc/mirofish-cli
- https://github.com/inematds/mirofish
- https://github.com/Artiffusion-Inc/MiroFish

The original project and major forks reviewed identify AGPL-3.0 licensing. We continue to treat them as research references rather than source-code dependencies for proprietary IZAKHONO products.

## What IZAKHONO should improve rather than copy

Decision Lab should differ in several important ways:

1. **Evidence discipline first** — every evidence-backed run should retain source hashes and separate sourced facts from synthetic reactions.
2. **Calibration** — outcomes from real deployments should be fed back as labelled observations so future runs can be compared with what actually happened.
3. **Alternative comparison** — compare Scenario A vs B rather than returning only one simulated future.
4. **Uncertainty ranges** — repeated runs should report distribution and disagreement rather than one confident verdict.
5. **Private-business mode** — simulations should work without pretending the business is a public social network.
6. **No required external graph cloud** — graph storage and memory should have an IZAKHONO-owned implementation.
7. **Provider-neutral inference** — models remain replaceable adapters under IZAKHONO SUPER AI.
8. **Decision audit trail** — each run gets an immutable manifest containing source hashes, scenario, assumptions, agent configuration and engine version.
9. **Red-team agents** — actively search for failure modes, fraud, legal/compliance risk, operational bottlenecks and second-order effects.
10. **Human decision ownership** — Decision Lab should present hypotheses, trade-offs and evidence gaps, not make the decision for the user.

## Current implementation status

BUSINESS AI v0.2 now implements the first clean-room layer:

- evidence-packet intake for text-based sources;
- SHA-256 source hashing;
- evidence graph construction;
- deterministic stakeholder personas;
- configurable multi-round reactions;
- group influence;
- consensus/disagreement analysis;
- real-world validation prompts;
- reproducible run IDs;
- JSON export.

The next technical layer is PDF/document extraction, richer entity/relationship modelling, larger agent populations, repeated-run comparison, Report Agent interrogation and post-run agent chat.
