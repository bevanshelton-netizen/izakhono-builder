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
