import type { ExecutionJob } from "./execution-orchestrator";
import { approveCampaign, createExecutionJob, markAdapterReady, queueApprovedCampaign } from "./execution-orchestrator";
import type { OptimizationApproval, OptimizationPlan } from "./optimization-orchestrator";
import { validateOptimizationPlan } from "./optimization-orchestrator";
import type { AdapterInstruction } from "./adapter-execution";
import { createAdapterInstruction } from "./adapter-execution";

export interface OptimizationExecutionRequest {
  schema: "izakhono.marketing.optimization-execution-request.v1";
  campaignId: string;
  channel: string;
  sourceApprovalId: string;
  optimizationApprovalId: string;
  action: OptimizationPlan["action"];
  requestedAt: string;
}

export function createOptimizationExecutionRequest(
  plan: OptimizationPlan,
  requestedAt: string,
): OptimizationExecutionRequest {
  validateOptimizationPlan(plan);
  if (plan.status !== "approved") throw new Error("Optimization plan must be approved before execution");
  if (!plan.optimizationApprovalId) throw new Error("Approved optimization plan requires an approval id");
  if (!requestedAt) throw new Error("Optimization execution requires a timestamp");

  return {
    schema: "izakhono.marketing.optimization-execution-request.v1",
    campaignId: plan.campaignId,
    channel: plan.channel,
    sourceApprovalId: plan.sourceApprovalId,
    optimizationApprovalId: plan.optimizationApprovalId,
    action: plan.action,
    requestedAt,
  };
}

export function executeApprovedOptimization(
  request: OptimizationExecutionRequest,
  executionApproval: OptimizationApproval,
  queuedAt: string,
  readyAt: string,
  actor: string,
): { job: ExecutionJob; instruction: AdapterInstruction } {
  if (request.schema !== "izakhono.marketing.optimization-execution-request.v1") {
    throw new Error("Invalid optimization execution request schema");
  }
  if (!request.campaignId || !request.sourceApprovalId || !request.optimizationApprovalId) {
    throw new Error("Optimization execution lineage is incomplete");
  }
  if (!executionApproval.approvalId || executionApproval.approvalId === request.sourceApprovalId || executionApproval.approvalId === request.optimizationApprovalId) {
    throw new Error("Optimization execution requires a distinct execution approval");
  }

  let job = createExecutionJob(request.campaignId, executionApproval.approvedAt, executionApproval.approvedBy);
  job = approveCampaign(job, executionApproval);
  job = queueApprovedCampaign(job, queuedAt, actor);
  job = markAdapterReady(job, readyAt, actor);

  const instruction = createAdapterInstruction(
    job,
    {
      schema: "izakhono.marketing.distribution.v1",
      source: "IZAKHONO MARKETING OS",
      approvalRequired: true,
      adapter: job.adapter,
      jobs: [],
    },
    readyAt,
  );

  return { job, instruction };
}
