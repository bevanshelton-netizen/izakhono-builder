# IZAKHONO NODE — Portable Execution Layer v1

## Purpose
Turn any IZAKHONO-controlled Windows/WSL/Linux machine into an interchangeable execution node.

**NODE01 is the first target, not a permanent dependency.**

## Contract
Builder/Control submits a signed deployment job. The node:
1. validates the manifest and job;
2. resolves immutable source;
3. builds in an isolated Docker context;
4. starts a canary;
5. checks health;
6. promotes only after health passes;
7. records evidence;
8. rolls back on failed promotion.

Management ports remain private. Public traffic is handled only by the reviewed EDGE/TLS layer.

## Portability
A node is identified by nodeId, not hostname, laptop or GitHub runner identity. NODE02/NODE03 can implement the same contract without changing applications.

## Sovereignty
izakhono-code is preferred. GitHub is a mirror/fallback only. Production refs are full commit SHAs.

## Safety
No browser path may execute arbitrary shell commands. Secrets remain machine-local. Public-live status requires independent HTTPS evidence.

## Activation
Use START-IZAKHONO-NODE.cmd on the owner machine after Docker/WSL readiness. This document defines the portable contract; it does not claim physical activation has occurred.

## Acceptance
A node is READY only when local NODE health, CONTROL health, Docker availability, canary health, evidence write and rollback path all pass.
