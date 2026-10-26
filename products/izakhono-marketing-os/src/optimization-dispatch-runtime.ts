import type { AdapterInstruction } from "./adapter-execution";
import { ExecutionLedger, type ExecutionAttemptResult, type ExecutionReceipt, type RetryPolicy } from "./execution-reliability";
import { dispatchAttempt } from "./reliable-dispatch";
import type { OptimizationExecutionRequest } from "./optimization-execution";

export interface OptimizationDispatchRequest {
  optimization: OptimizationExecutionRequest;
  instruction: AdapterInstruction;
  network: string;
  scheduledAt: string;
  executionId: string;
  attempt: number;
  recordedAt: string;
}

export interface OptimizationDispatchResult {
  receipt: ExecutionReceipt;
  duplicate: boolean;
}

export class OptimizationDispatchRuntime {
  constructor(private readonly ledger: ExecutionLedger = new ExecutionLedger()) {}

  dispatch(request: OptimizationDispatchRequest, result: ExecutionAttemptResult, policy: RetryPolicy): OptimizationDispatchResult {
    if (request.instruction.campaignId !== request.optimization.campaignId) throw new Error("Optimization dispatch campaign mismatch");
    if (request.instruction.approvalId === request.optimization.sourceApprovalId || request.instruction.approvalId === request.optimization.optimizationApprovalId) {
      throw new Error("Optimization dispatch requires a distinct execution approval");
    }
    if (!request.instruction.jobs.some((job) => job.network === request.network && job.scheduledAt === request.scheduledAt)) {
      throw new Error("Optimization dispatch network and schedule mismatch");
    }
    return dispatchAttempt({ executionId: request.executionId, instruction: request.instruction, network: request.network, scheduledAt: request.scheduledAt, attempt: request.attempt, recordedAt: request.recordedAt }, result, policy, this.ledger);
  }
}
