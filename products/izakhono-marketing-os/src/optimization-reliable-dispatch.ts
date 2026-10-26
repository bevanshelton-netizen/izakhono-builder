import type { AdapterInstruction } from "./adapter-execution";
import type { OptimizationExecutionRequest } from "./optimization-execution";
import { createIdempotencyKey, ExecutionLedger, type ExecutionAttemptResult, type ExecutionReceipt, type RetryPolicy } from "./execution-reliability";
import { createExecutionReceipt } from "./execution-reliability";

export interface OptimizationDispatchRequest {
  executionId: string;
  optimization: OptimizationExecutionRequest;
  instruction: AdapterInstruction;
  network: string;
  scheduledAt: string;
  attempt: number;
  recordedAt: string;
}

export function dispatchOptimizationAttempt(
  request: OptimizationDispatchRequest,
  result: ExecutionAttemptResult,
  policy: RetryPolicy,
  ledger: ExecutionLedger,
): ExecutionReceipt {
  if (request.optimization.schema !== "izakhono.marketing.optimization-execution-request.v1") {
    throw new Error("Invalid optimization execution request schema");
  }
  if (request.instruction.campaignId !== request.optimization.campaignId) {
    throw new Error("Optimization dispatch campaign mismatch");
  }
  if (request.instruction.approvalId === request.optimization.sourceApprovalId || request.instruction.approvalId === request.optimization.optimizationApprovalId) {
    throw new Error("Optimization dispatch requires a distinct execution approval");
  }
  if (!request.network || !request.scheduledAt) throw new Error("Optimization dispatch identity is required");

  const idempotencyKey = createIdempotencyKey(
    request.optimization.campaignId,
    request.instruction.approvalId,
    request.network,
    request.scheduledAt,
  );

  if (ledger.has(idempotencyKey)) throw new Error("Duplicate optimization dispatch blocked");
  ledger.register(idempotencyKey);

  return createExecutionReceipt(
    request.executionId,
    request.optimization.campaignId,
    request.instruction.approvalId,
    idempotencyKey,
    request.attempt,
    result,
    request.recordedAt,
    request.instruction.adapter,
    policy,
  );
}
