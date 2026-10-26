export type CampaignState =
  | "draft"
  | "approved"
  | "queued"
  | "ready_for_adapter"
  | "rejected";

export interface ApprovalRecord {
  approvalId: string;
  approvedAt: string;
  approvedBy: string;
}

export interface AuditEvent {
  event: "created" | "approved" | "queued" | "adapter_ready" | "rejected";
  at: string;
  actor: string;
  state: CampaignState;
}

export interface ExecutionJob {
  campaignId: string;
  state: CampaignState;
  approval?: ApprovalRecord;
  queuedAt?: string;
  adapter: "metricool" | "owned";
  audit: AuditEvent[];
}

const allowedTransitions: Record<CampaignState, CampaignState[]> = {
  draft: ["approved", "rejected"],
  approved: ["queued", "rejected"],
  queued: ["ready_for_adapter", "rejected"],
  ready_for_adapter: [],
  rejected: [],
};

export function transitionCampaign(
  job: ExecutionJob,
  next: CampaignState,
  at: string,
  actor: string,
): ExecutionJob {
  if (!allowedTransitions[job.state].includes(next)) {
    throw new Error(`Invalid campaign transition: ${job.state} -> ${next}`);
  }

  return {
    ...job,
    state: next,
    audit: [...job.audit, { event: next === "approved" ? "approved" : next === "queued" ? "queued" : next === "ready_for_adapter" ? "adapter_ready" : "rejected", at, actor, state: next }],
  };
}

export function createExecutionJob(
  campaignId: string,
  at: string,
  actor: string,
  adapter: "metricool" | "owned" = "metricool",
): ExecutionJob {
  return {
    campaignId,
    state: "draft",
    adapter,
    audit: [{ event: "created", at, actor, state: "draft" }],
  };
}

export function approveCampaign(
  job: ExecutionJob,
  approval: ApprovalRecord,
): ExecutionJob {
  if (!approval.approvalId || !approval.approvedAt || !approval.approvedBy) {
    throw new Error("Complete approval record is required");
  }
  const approved = transitionCampaign(job, "approved", approval.approvedAt, approval.approvedBy);
  return { ...approved, approval };
}

export function queueApprovedCampaign(
  job: ExecutionJob,
  queuedAt: string,
  actor: string,
): ExecutionJob {
  if (job.state !== "approved" || !job.approval) {
    throw new Error("Campaign must be approved before queueing");
  }
  return transitionCampaign(job, "queued", queuedAt, actor);
}

export function markAdapterReady(
  job: ExecutionJob,
  at: string,
  actor: string,
): ExecutionJob {
  if (job.state !== "queued" || !job.approval) {
    throw new Error("Campaign must be approved and queued before adapter execution");
  }
  return transitionCampaign(job, "ready_for_adapter", at, actor);
}
