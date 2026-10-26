import type { DistributionPlan } from "./social-command";
import type { ExecutionJob } from "./execution-orchestrator";

export interface AdapterInstruction {
  schema: "izakhono.marketing.adapter-instruction.v1";
  campaignId: string;
  adapter: "metricool" | "owned";
  approvalId: string;
  issuedAt: string;
  jobs: DistributionPlan["jobs"];
}

export function createAdapterInstruction(
  execution: ExecutionJob,
  distribution: DistributionPlan,
  issuedAt: string,
): AdapterInstruction {
  if (execution.state !== "ready_for_adapter") {
    throw new Error("Campaign must be adapter-ready before execution");
  }
  if (!execution.approval) {
    throw new Error("Adapter execution requires an approval record");
  }
  if (distribution.campaignId !== undefined && distribution.jobs.some((job) => job.campaignId !== execution.campaignId)) {
    throw new Error("Distribution plan campaign mismatch");
  }
  if (distribution.approvalRequired !== true) {
    throw new Error("Distribution approval gate is required");
  }

  return {
    schema: "izakhono.marketing.adapter-instruction.v1",
    campaignId: execution.campaignId,
    adapter: execution.adapter,
    approvalId: execution.approval.approvalId,
    issuedAt,
    jobs: distribution.jobs.map((job) => ({ ...job })),
  };
}

export function validateAdapterInstruction(instruction: AdapterInstruction): void {
  if (instruction.schema !== "izakhono.marketing.adapter-instruction.v1") {
    throw new Error("Invalid adapter instruction schema");
  }
  if (!instruction.campaignId || !instruction.approvalId || !instruction.issuedAt) {
    throw new Error("Incomplete adapter instruction");
  }
  if (!instruction.jobs.length) {
    throw new Error("Adapter instruction requires at least one distribution job");
  }
  for (const job of instruction.jobs) {
    if (job.campaignId !== instruction.campaignId) {
      throw new Error("Adapter job campaign mismatch");
    }
    if (job.status !== "ready_for_adapter") {
      throw new Error("Only adapter-ready jobs may be executed");
    }
  }
}
