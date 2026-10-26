import type { AdapterInstruction } from "./adapter-execution";
import {
  createExecutionReceipt,
  createIdempotencyKey,
  ExecutionLedger,
  type ExecutionAttemptResult,
  type ExecutionReceipt,
  type RetryPolicy,
} from "./execution-reliability";

export interface DispatchRequest {
  executionId: string;
  instruction: AdapterInstruction;
  network: string;
  scheduledAt: string;
  attempt: number;
  recordedAt: string;
}

export interface DispatchResult {
  receipt: ExecutionReceipt;
  duplicate: boolean;
}

export function dispatchAttempt(
  request: DispatchRequest,
  result: ExecutionAttemptResult,
  policy: RetryPolicy,
  ledger: ExecutionLedger,
): DispatchResult {
  const idempotencyKey = createIdempotencyKey(
    request.instruction.campaignId,
    request.instruction.approvalId,
    request.network,
    request.scheduledAt,
  );

  if (ledger.has(idempotencyKey)) {
    throw new Error("Duplicate dispatch blocked by idempotency ledger");
  }

  ledger.register(idempotencyKey);

  const receipt = createExecutionReceipt(
    request.executionId,
    request.instruction.campaignId,
    request.instruction.approvalId,
    idempotencyKey,
    request.attempt,
    result,
    request.recordedAt,
    request.instruction.adapter,
    policy,
  );

  return { receipt, duplicate: false };
}
