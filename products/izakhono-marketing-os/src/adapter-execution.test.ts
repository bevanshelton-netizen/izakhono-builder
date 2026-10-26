import { buildDistributionPlan } from "./social-command";
import { approveCampaign, createExecutionJob, markAdapterReady, queueApprovedCampaign } from "./execution-orchestrator";
import { createAdapterInstruction, validateAdapterInstruction } from "./adapter-execution";

const created = createExecutionJob("campaign-001", "2026-10-27T08:00:00+02:00", "Bevan Shelton");
const approved = approveCampaign(created, {
  approvalId: "approval-001",
  approvedAt: "2026-10-27T08:02:00+02:00",
  approvedBy: "Bevan Shelton",
});
const queued = queueApprovedCampaign(approved, "2026-10-27T08:03:00+02:00", "Bevan Shelton");
const ready = markAdapterReady(queued, "2026-10-27T08:04:00+02:00", "IZAKHONO MARKETING OS");

const distribution = buildDistributionPlan(
  "campaign-001",
  "Launch your next campaign",
  "Turn one product brief into a complete marketing system.",
  ["facebook", "instagram", "linkedin", "whatsapp"],
  "2026-10-27T09:00:00+02:00",
);

const instruction = createAdapterInstruction(ready, distribution, "2026-10-27T08:05:00+02:00");
validateAdapterInstruction(instruction);

if (instruction.campaignId !== "campaign-001") throw new Error("Campaign ID must be preserved");
if (instruction.approvalId !== "approval-001") throw new Error("Approval ID must be preserved");
if (instruction.jobs.length !== 4) throw new Error("Expected four adapter jobs");
if (!instruction.jobs.every((job) => job.status === "ready_for_adapter")) throw new Error("Only adapter-ready jobs may execute");

let blocked = false;
try {
  createAdapterInstruction(created, distribution, "2026-10-27T08:05:00+02:00");
} catch {
  blocked = true;
}
if (!blocked) throw new Error("Unapproved execution must be blocked");

console.log("IZAKHONO MARKETING OS adapter execution contract validated");
