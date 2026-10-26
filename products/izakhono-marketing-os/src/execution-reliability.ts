export type ExecutionAttemptResult = "success" | "retryable_failure" | "permanent_failure";

export type ExecutionNextAction = "complete" | "retry" | "dead_letter";

export interface RetryPolicy {
  maxAttempts: number;
}

export interface ExecutionReceipt {
  schema: "izakhono.marketing.execution-receipt.v1";
  executionId: string;
  campaignId: string;
  approvalId: string;
  idempotencyKey: string;
  attempt: number;
  result: ExecutionAttemptResult;
  nextAction: ExecutionNextAction;
  recordedAt: string;
  adapter: "metricool" | "owned";
}

export function createIdempotencyKey(
  campaignId: string,
  approvalId: string,
  network: string,
  scheduledAt: string,
): string {
  if (!campaignId || !approvalId || !network || !scheduledAt) {
    throw new Error("Idempotency identity fields are required");
  }
  return `${campaignId}:${approvalId}:${network}:${scheduledAt}`;
}

export class ExecutionLedger {
  private readonly keys = new Set<string>();

  has(key: string): boolean {
    return this.keys.has(key);
  }

  register(key: string): void {
    if (!key) throw new Error("Execution idempotency key is required");
    if (this.keys.has(key)) throw new Error("Duplicate execution blocked");
    this.keys.add(key);
  }
}

export function canRetry(
  attempt: number,
  result: ExecutionAttemptResult,
  policy: RetryPolicy,
): boolean {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Execution attempt must be a positive integer");
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) {
    throw new Error("Retry policy maxAttempts must be a positive integer");
  }
  return result === "retryable_failure" && attempt < policy.maxAttempts;
}

export function createExecutionReceipt(
  executionId: string,
  campaignId: string,
  approvalId: string,
  idempotencyKey: string,
  attempt: number,
  result: ExecutionAttemptResult,
  recordedAt: string,
  adapter: "metricool" | "owned",
  policy: RetryPolicy,
): ExecutionReceipt {
  if (!executionId || !campaignId || !approvalId || !idempotencyKey || !recordedAt) {
    throw new Error("Incomplete execution receipt");
  }

  const retry = canRetry(attempt, result, policy);
  return {
    schema: "izakhono.marketing.execution-receipt.v1",
    executionId,
    campaignId,
    approvalId,
    idempotencyKey,
    attempt,
    result,
    nextAction: result === "success" ? "complete" : retry ? "retry" : "dead_letter",
    recordedAt,
    adapter,
  };
}

export function validateExecutionReceipt(receipt: ExecutionReceipt): void {
  if (receipt.schema !== "izakhono.marketing.execution-receipt.v1") throw new Error("Invalid execution receipt schema");
  if (!receipt.executionId || !receipt.campaignId || !receipt.approvalId || !receipt.idempotencyKey || !receipt.recordedAt) {
    throw new Error("Incomplete execution receipt");
  }
  if (!Number.isInteger(receipt.attempt) || receipt.attempt < 1) throw new Error("Invalid execution attempt");
  if (!["success", "retryable_failure", "permanent_failure"].includes(receipt.result)) {
    throw new Error("Invalid execution result");
  }
  if (!["complete", "retry", "dead_letter"].includes(receipt.nextAction)) {
    throw new Error("Invalid execution next action");
  }
  if (receipt.result === "success" && receipt.nextAction !== "complete") throw new Error("Successful execution must complete");
  if (receipt.result === "permanent_failure" && receipt.nextAction !== "dead_letter") throw new Error("Permanent failure must dead-letter");
  if (receipt.adapter !== "metricool" && receipt.adapter !== "owned") throw new Error("Invalid execution adapter");
}
