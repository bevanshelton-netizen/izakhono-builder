# IZAKHONO Node Execution Architecture Reconciliation — V1

**Status:** Source inspection completed; reconciliation findings documented; implementation changes not authorised by this document.
**Reviewed against:** `main` at the current repository state and PR #761 branch at its recorded head.
**Related contract:** `IZAKHONO-NODE-EXECUTION-BINDING-CONTRACT-V1.md`
**Cost and production boundary:** Zero spend. No execution environment was enrolled, no credentials were accessed, and no service, DNS, mail, database or production state was changed.

## 1. Executive finding

The repository already has a binding system-wide identity decision: **NODE01 is software, not physical infrastructure**. The authoritative rule is `architecture/NODE01-IDENTITY-STANDARD.md`, reinforced by the root `AGENTS.md` and `scripts/architecture/check-node01-identity.py`.

The existing software-node architecture in `products/izakhono-host/SOFTWARE-NODE-V1.md` is consistent with that standard. It says a physical server is not a prerequisite and treats execution substrates as replaceable. The current gap is implementation and documentation drift: several execution, state, security and operational components do not yet implement the complete Node / workload / execution-environment / binding separation.

**Conclusion:** Do not create a second Node registry or deploy an execution adapter yet. First align the existing components to one explicit authority model, correct the hostname-derived Node identity in the existing node agent, and define the authoritative persistence and audit boundary.

## 2. Source-of-truth map

| Concern | Existing repository source | What it actually establishes | Reconciliation decision |
|---|---|---|---|
| NODE01 identity | `architecture/NODE01-IDENTITY-STANDARD.md`; root `AGENTS.md` | Stable logical software identity; environment locator is separate; replacement must preserve NODE01 | Highest-priority identity invariant; product docs and code must conform |
| Software Node architecture | `products/izakhono-host/SOFTWARE-NODE-ARCHITECTURE.md`; `SOFTWARE-NODE-V1.md` | Provider-neutral logical Nodes, capabilities, evidence-based promotion and replaceable substrates | Retain as HOST's infrastructure architecture baseline |
| Node roles and placement | `products/izakhono-host/CLUSTER-NODE-ROLES.md` | CONTROL, EDGE, DNS, RUNTIME, DATA, MAIL, BACKUP and FORTRESS are workload/role responsibilities | Treat role labels as logical placement intent, not machines or proof of capacity |
| NODE01 orchestration | `products/node01-agent-fabric/ORCHESTRATION-V1.md`; `src/node01/registry.py`, `policy.py`, `executors.py` | Agent capability registry, bounded task policy and deterministic executor | This is an agent/tool registry, not an infrastructure Node or execution-environment registry |
| NODE01 control-plane prototype | `products/node01-agent-fabric/src/node01/control_plane.py` | In-memory queue, observer and planning/draft interfaces; provisioner currently returns a plan | Useful orchestration prototype; not the durable Runtime Fabric deployment authority |
| HOST runtime state | `products/izakhono-host/runtime/control-plane/state.mjs` | JSON state shape includes nodes, deployments, revisions and routes | Existing state container, but no versioned Node/environment binding schema or transactional registry is established by this file |
| HOST site control plane | `products/izakhono-host/runtime/control-plane/server.mjs` | Authenticated site provisioning/content API and local JSON persistence | Owns site workflow; it is not the source of truth for Node identity or execution authorization |
| HOST customer provisioning | `products/izakhono-host/runtime/provisioner/state-machine.mjs`; provisioner README | Idempotency key, bounded retries, state transitions and acceptance evidence requirements | Retain for customer lifecycle; do not reuse as the Node-binding lifecycle |
| FORTRESS egress policy | `products/izakhono-fortress/README.md`, `guard.py`, `policy.json` | Default-deny policy decision point for declared external egress, scoped by entity | Do not represent this implementation as the complete deployment authorization, secrets or immutable audit service |
| FORTRESS risk engine | `products/fortress/ENGINE-ARCHITECTURE.md` | Financial/cyber risk intelligence, decisioning and case workflows | Separate product capability; not an infrastructure execution registry |
| MAIL workload boundary | `docs/architecture/IZAKHONO-MAIL-RUNTIME-FABRIC-INTEGRATION-V1.md` | Separates MAIL API, mail transport, webmail and edge; defines required CONTROL → Runtime Fabric → adapter → HOST path | Use as the workload integration reference; its own text explicitly says the contract is proposed and not activated |
| MAIL runtime status | `products/izakhono-mail/runtime-v1/DEPLOYMENT-STATUS.md` | Build committed; runtime not provisioned; public DNS and send/receive not verified | Mail remains non-live; no migration or DNS change is implied |

## 3. Verified implementation gaps

### G1 — Existing node agent derives logical identity from the environment

In `products/izakhono-node/node_agent.py`, the current declaration is:

```python
NODE_ID = os.getenv("IZAKHONO_NODE_ID", socket.gethostname() or "izakhono-node")
```

The health, readiness, status and deployment-proof responses then report this value as `node_id`. When the environment variable is absent, the execution environment's hostname becomes the reported logical Node identity. This conflicts with the mandatory identity standard, which prohibits deriving NODE01 identity from a hostname or infrastructure locator.

**Required correction before enrollment:** separate an explicitly configured logical software identity from a separately registered execution-environment identity and locator. Missing logical identity or missing authorised binding must fail closed. Do not silently migrate or reinterpret existing hostnames as Node IDs.

The same agent launches a configured deployer subprocess and checks Docker readiness. Its existing HMAC request verification and job validation are useful controls, but they do not establish an approved Node-to-environment binding, a FORTRESS authorization receipt or a centrally durable audit transaction. The existing `products/izakhono-node/install.sh` also writes the legacy `IZAKHONO_NODE_ID=node01` setting and does not provision a separately approved execution-environment identity. The existing `products/izakhono-node/README.md` still describes the product in hardware/physical-node terms, despite the mandatory system-wide identity standard.

### G2 — No authoritative infrastructure Node/binding registry is established by inspected code

The NODE01 `registry.py` registers agents and capabilities. It does not register infrastructure Nodes, workloads, execution environments or bindings.

HOST's `state.mjs` initializes a JSON document with `nodes`, `deployments`, `revisions` and `routes`, but the inspected module only supplies file-backed load/save/mutate operations. The existence of a `nodes` object is not proof of a defined registry, schema, uniqueness rule, authorization lifecycle or concurrency-safe authoritative store.

**Required correction:** designate one authoritative registry and owner before implementation. Reuse the existing Runtime Fabric/CONTROL state boundary only if its implementation is extended and approved to own the full versioned lifecycle. Do not add a competing registry under HOST, NODE01 agent fabric, or FORTRESS.

### G3 — FORTRESS implementation scope is narrower than the proposed execution authority

The current `products/izakhono-fortress/guard.py` exposes health, policy and egress-authorization endpoints. Its README explicitly describes it as a policy decision point, not a transparent network firewall. The inspected interface does not expose Node-binding approval, workload deployment authorization, execution-environment attestation, secret-reference resolution or an immutable deployment audit ledger.

**Required correction:** preserve the existing egress policy service as a bounded FORTRESS capability. Separately specify the authoritative authorization and evidence interfaces needed for deployment, and reconcile them with FORTRESS identity/policy owners before adding endpoints. Do not imply that a successful egress decision authorizes infrastructure execution.

### G4 — Runtime Fabric is not yet demonstrated as the durable deployment authority

The inspected NODE01 orchestration contract describes a bounded agent workflow, but explicitly lists durable orchestration state, authenticated approval-bearing operator control and durable replay/recovery as hardening work. The inspected control-plane prototype uses in-memory queue and observer implementations. The MAIL integration contract also states that independently committing stores must not be described as atomic and requires an approved transaction or transactional-outbox boundary.

**Required correction:** establish the authoritative store, transaction boundary, idempotency claim/result semantics, audit/outbox design, lease/recovery model and evidence retention before any production execution adapter is connected.

### G5 — HOST customer lifecycle and infrastructure binding are different state machines

HOST's provisioner governs customer onboarding from payment through domain, DNS, site, TLS, mail and acceptance. Its `LIVE` state requires HTTPS, DNS, content and mail evidence. That is a customer-service lifecycle, not a Node-binding lifecycle.

**Required correction:** retain this state machine for customer provisioning. Implement the Node, workload, environment and binding lifecycle separately within the designated infrastructure authority. Customer `LIVE` must depend on accepted workload evidence and must never be inferred from a binding being active.

### G6 — Operational documents still contain stale or conflicting substrate assumptions

The repository includes a software-node standard and a corrected execution-environment activation gate, but other HOST, NODE and MAIL documents still use language such as physical-node activation, refer to available owned nodes as if execution capacity were already verified, or describe a preferred external provider. For example, `products/izakhono-host/README.md` still refers to validating a “physical node”; `products/izakhono-node/README.md` describes hardware-controlled compute and physical nodes; `products/izakhono-mail/runtime-v1/ops/DEPLOY-PROVIDER-NEUTRAL.md` specifies a public Linux/Docker target; and `PROVIDER-GATE.md` records an earlier preferred-provider research position.

**Required correction:** classify each statement as logical architecture, execution-environment requirement, historical research or current verified operational fact. Preserve provider-neutrality and the zero-spend rule. Do not treat a provider preference, runbook or repository configuration as an approved environment or purchase authorization.

## 4. Authority model to reconcile and then implement

The following is the recommended responsibility split, subject to approval by the owners of the canonical components:

1. **FORTRESS:** policy and identity decisions; approval of actor, workload, environment and operation scope; protected secret references; authorization evidence and revocation policy. Existing egress policy remains one bounded sub-capability.
2. **NODE01 / Runtime Fabric:** logical Node and workload orchestration state; scheduling and placement decisions; binding lifecycle coordination; durable deployment lifecycle, idempotency, recovery and correlation.
3. **HOST:** customer-facing hosting products and workflows; maps accepted HOST workloads to customer service states; does not create infrastructure identity or bypass Runtime Fabric.
4. **Execution adapter:** typed, allow-listed operations against one explicitly registered and approved execution environment; returns signed or otherwise verifiable receipts; cannot grant itself authority.
5. **Execution-environment operator:** owns the substrate, its capacity, network, storage and operating-system boundary. Its locator remains separate from the logical Node identity.

This responsibility split is a reconciliation target, not a claim that every interface is already implemented or that all authority owners have formally approved it.

## 5. Required implementation sequence

1. **Correct identity derivation:** update the existing node agent contract so hostname, IP, provider ID and container ID are execution-environment metadata only. Add tests that reject hostname-derived logical identity.
2. **Approve the authority map:** identify the existing authoritative FORTRESS policy/identity interface and NODE01/Runtime Fabric durable state owner. Record explicit owners and API boundaries. Do not create a duplicate registry.
3. **Define schemas:** version Node, workload, execution-environment, binding, approval, attestation and execution-receipt records. Add uniqueness, lifecycle and referential-integrity rules.
4. **Define durable transaction and audit semantics:** idempotency, approval, state transition and audit/outbox must be recoverable and concurrency-safe.
5. **Specify typed adapter operations:** begin with read-only discovery and capability inspection. Mutating operations remain unavailable until binding, approval, policy and audit tests pass.
6. **Reconcile HOST and MAIL runbooks:** remove stale physical-Node language and distinguish provider research from approved execution-environment records.
7. **Validate in CI:** run the mandatory NODE01 identity checker and targeted tests for identity separation, missing binding, expired/revoked approval, replay, tenant/environment mismatch, adapter scope and audit evidence. Extend the identity checker or add a targeted static test so hostname-derived identity (including `socket.gethostname()`) and legacy `IZAKHONO_NODE_ID` configuration are detected; the current regex gate can pass while this semantic fallback remains present.
8. **Only after all gates pass:** propose a separately reviewed, owner-approved execution-environment connection. No provisioning, spending, DNS changes, mail cutover or production deployment is included in this sequence without explicit approval.

## 6. Explicit non-claims and current state

- No authoritative Node-to-execution-environment registry has been verified as implemented end-to-end.
- No execution environment is verified as connected and approved by this reconciliation.
- No deployment adapter is certified for production use.
- No FORTRESS deployment-authorization or secret-injection interface is claimed by the current egress guard.
- No mail runtime, public DNS, external mail delivery or customer mailbox is declared live by repository documentation alone.
- No provider has been selected or approved for spend by this work.
- No physical computer is required to define a logical IZAKHONO Node.

**Disposition:** keep PR #761 in draft. This reconciliation is documentation-only and should be reviewed alongside the Node-to-Execution Binding Contract before implementation work is authorised.
