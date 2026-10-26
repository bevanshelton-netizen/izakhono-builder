import { createAdapterInstruction } from "./adapter-execution";
import { buildDistributionPlan } from "./social-command";
import { approveCampaign, createExecutionJob, markAdapterReady, queueApprovedCampaign } from "./execution-orchestrator";
import { deriveOptimizationSignal, recordCampaignResult } from "./measurement-feedback";

const created = createExecutionJob("campaign-feedback-001", "2026-10-27T08:00:00+02:00", "Bevan Shelton");
const approved = approveCampaign(created, {
  approvalId: "approval-feedback-001",
  approvedAt: "2026-10-27T08:02:00+02:00",
  approvedBy: "Bevan Shelton",
});
const queued = queueApprovedCampaign(approved, "2026-10-27T08:03:00+02:00", "Bevan Shelton");
const ready = markAdapterReady(queued, "2026-10-27T08:04:00+02:00", "IZAKHONO MARKETING OS");
const distribution = buildDistributionPlan(
  "campaign-feedback-001",
  "Launch your next campaign",
  "Turn one product brief into a complete marketing system.",
  ["facebook"],
  "2026-10-27T09:00:00+02:00",
);
const instruction = createAdapterInstruction(ready, distribution, "2026-10-27T08:05:00+02:00");

const result = recordCampaignResult(instruction, {
  campaignId: "campaign-feedback-001",
  instructionApprovalId: "approval-feedback-001",
  channel: "facebook",
  impressions: 10000,
  engagements: 500,
  conversions: 60,
  spend: 300,
  capturedAt: "2026-10-27T12:00:00+02:00",
});
const signal = deriveOptimizationSignal(result);

if (signal.recommendation !== "scale") throw new Error("Expected strong campaign to produce scale signal");
if (signal.engagementRate !== 0.05) throw new Error("Engagement rate calculation failed");
if (signal.conversionRate !== 0.12) throw new Error("Conversion rate calculation failed");
if (signal.costPerConversion !== 5) throw new Error("Cost-per-conversion calculation failed");

let blocked = false;
try {
  recordCampaignResult(instruction, { ...result, instructionApprovalId: "wrong-approval" });
} catch {
  blocked = true;
}
if (!blocked) throw new Error("Mismatched approval must be blocked");

console.log("IZAKHONO MARKETING OS measurement feedback contract validated");
