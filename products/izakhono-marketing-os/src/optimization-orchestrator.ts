import type { OptimizationSignal } from "./measurement-feedback";

export type OptimizationAction = "scale" | "maintain" | "improve" | "pause";

export interface OptimizationApproval {
  approvalId: string;
  approvedAt: string;
  approvedBy: string;
}

export interface OptimizationPlan {
  schema: "izakhono.marketing.optimization-plan.v1";
  campaignId: string;
  channel: string;
  sourceApprovalId: string;
  action: OptimizationAction;
  reason: string;
  createdAt: string;
  approvalRequired: true;
  status: "proposed" | "approved";
}

export function createOptimizationPlan(
  signal: OptimizationSignal,
  sourceApprovalId: string,
  createdAt: string,
): OptimizationPlan {
  if (!sourceApprovalId || !createdAt) throw new Error("Optimization plan requires source approval and timestamp");
  if (!signal.campaignId || !signal.channel) throw new Error("Optimization signal identity is required");

  const reasons: Record<OptimizationAction, string> = {
    scale: "Strong engagement and conversion performance supports controlled scaling",
    maintain: "Performance is within the maintain band",
    improve: "Performance requires creative, targeting, or funnel improvement",
    pause: "Low engagement and conversion performance warrants pausing",
  };

  return {
    schema: "izakhono.marketing.optimization-plan.v1",
    campaignId: signal.campaignId,
    channel: signal.channel,
    sourceApprovalId,
    action: signal.recommendation,
    reason: reasons[signal.recommendation],
    createdAt,
    approvalRequired: true,
    status: "proposed",
  };
}

export function approveOptimizationPlan(
  plan: OptimizationPlan,
  approval: OptimizationApproval,
): OptimizationPlan {
  if (plan.status !== "proposed") throw new Error("Only proposed optimization plans can be approved");
  if (!approval.approvalId || !approval.approvedAt || !approval.approvedBy) {
    throw new Error("Optimization approval record is incomplete");
  }
  if (approval.approvalId === plan.sourceApprovalId) {
    throw new Error("Optimization requires a distinct approval record");
  }
  return { ...plan, status: "approved" };
}

export function validateOptimizationPlan(plan: OptimizationPlan): void {
  if (plan.schema !== "izakhono.marketing.optimization-plan.v1") throw new Error("Invalid optimization plan schema");
  if (!plan.campaignId || !plan.channel || !plan.sourceApprovalId || !plan.createdAt) {
    throw new Error("Incomplete optimization plan");
  }
  if (plan.approvalRequired !== true) throw new Error("Optimization approval gate is required");
  if (!["scale", "maintain", "improve", "pause"].includes(plan.action)) throw new Error("Invalid optimization action");
  if (!["proposed", "approved"].includes(plan.status)) throw new Error("Invalid optimization plan status");
}
