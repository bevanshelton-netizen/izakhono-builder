import {
  buildDistributionPlan,
  DistributionPlan,
  SocialNetwork,
} from "./social-command";
import {
  approveCampaign,
  createExecutionJob,
  markAdapterReady,
  queueApprovedCampaign,
  ExecutionJob,
} from "./execution-orchestrator";

export interface MarketingExecution {
  job: ExecutionJob;
  distribution: DistributionPlan;
}

export function createMarketingExecution(
  campaignId: string,
  headline: string,
  primaryCopy: string,
  networks: SocialNetwork[],
  scheduledAt: string,
  createdAt: string,
): MarketingExecution {
  const job = createExecutionJob(campaignId, createdAt, "IZAKHONO MARKETING OS");
  const distribution = buildDistributionPlan(
    campaignId,
    headline,
    primaryCopy,
    networks,
    scheduledAt,
  );
  return {
    job,
    distribution: {
      ...distribution,
      jobs: distribution.jobs.map((item) => ({ ...item, status: "draft" })),
    },
  };
}

export function executeApprovedMarketingCampaign(
  execution: MarketingExecution,
  approvalId: string,
  approvedAt: string,
  approvedBy: string,
  queuedAt: string,
  adapterReadyAt: string,
): MarketingExecution {
  const approved = approveCampaign(execution.job, {
    approvalId,
    approvedAt,
    approvedBy,
  });
  const queued = queueApprovedCampaign(approved, queuedAt, approvedBy);
  const ready = markAdapterReady(queued, adapterReadyAt, "IZAKHONO MARKETING OS");
  return {
    job: ready,
    distribution: {
      ...execution.distribution,
      jobs: execution.distribution.jobs.map((item) => ({
        ...item,
        status: "ready_for_adapter",
      })),
    },
  };
}
