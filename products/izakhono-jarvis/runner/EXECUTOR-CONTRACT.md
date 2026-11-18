# J.A.R.V.I.S. Executor Contract v1

The worker bridge sends one claimed workforce step to a separately deployed HTTPS executor. The executor is an execution boundary, not a reasoning-only response generator.

## Request

- Method: `POST`
- Authentication: `Authorization: Bearer <token>`
- Idempotency: `Idempotency-Key: jarvis-step-<step-id>`
- JSON contract: `izakhono.jarvis.executor/v1`

Example body:

```json
{
  "contract": "izakhono.jarvis.executor/v1",
  "idempotency_key": "jarvis-step-step-123",
  "step": {
    "id": "step-123",
    "title": "Prepare the approved supplier comparison",
    "description": "Use the authorised source records attached to this task.",
    "agent_id": "business-analyst"
  }
}
```

## Required executor behavior

1. Authenticate the bearer token and enforce the caller's authorised scope.
2. Validate the contract, task identifier, agent identifier, and bounded input lengths.
3. Treat the idempotency key as a durable unique operation key. Persist the key and execution outcome atomically with the operation, or use an equivalent durable idempotency ledger.
4. For a repeated key, return the original terminal result; never repeat an already-applied external side effect.
5. Reject reuse of the same key with a materially different request body.
6. Enforce task-specific permissions. Approval to run a workforce step is not blanket permission for payments, purchases, messages, account changes, or other irreversible external actions.
7. For externally consequential actions, require a separately recorded owner approval and verify that approval at execution time. If no authorised adapter or approval exists, do not perform the action.
8. Return only after the bounded operation reaches a terminal state. Use a timeout no longer than the worker's 60-second execution limit.
9. Return evidence that identifies what was actually done, the relevant source or operation reference, and the outcome. Do not fabricate evidence or describe a plan as completed work.
10. Do not expose credentials, private source records, stack traces, or internal secrets in evidence.

## Response

Successful terminal response:

```json
{
  "status": "completed",
  "evidence": "Created comparison report report-456 from authorised supplier records; no purchase order was issued."
}
```

- `status` must be `completed`.
- `evidence` must contain 8–2000 characters.
- Failed or ambiguous operations must not return `completed`.
- A timeout or lost response must be safely retryable using the same idempotency key.

## Release gate

The J.A.R.V.I.S. worker bridge transmits the stable key in both the HTTP header and JSON body. Production activation remains blocked until a real executor endpoint implements and demonstrates this contract, is deployed over HTTPS, and its hostname is included in the executor allowlist. A mock response or a reasoning-only agent is not a production executor.
