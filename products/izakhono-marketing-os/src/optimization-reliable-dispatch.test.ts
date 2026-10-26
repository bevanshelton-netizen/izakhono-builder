import { createAdapterInstruction } from "./adapter-execution";
import { approveCampaign, createExecutionJob, markAdapterReady, queueApprovedCampaign } from "./execution-orchestrator";
import { approveOptimizationPlan, createOptimizationPlan } from "./optimization-orchestrator";
import { createOptimizationExecutionRequest } from "./optimization-execution";
import { dispatchOptimizationAttempt } from "./optimization-reliable-dispatch";
import { ExecutionLedger } from "./execution-reliability";
import { deriveOptimizationSignal } from "./measurement-feedback";
import { buildDistributionPlan } from "./social-command";

const signal = deriveOptimizationSignal({
  campaignId: "campaign-001",
  instructionApprovalId: "execution-001",
  channel: "linkedin",
  impressions: 10000,
  engagements: 500,
  conversions: 60,
  spend: 300,
  capturedAt: "2026-10-26T20:00:00Z",
});

const plan = createOptimizationPlan(signal, "execution-001", "2026-10-26T20:01:00Z");
const approvedPlan = approveOptimizationPlan(plan, {
  approvalId: "optimization-001",
  approvedAt: "2026-10-26T20:02:00Z",
  approvedBy: "bevan",
});
const request = createOptimizationExecutionRequest(approvedPlan, "2026-10-26T20:03:00Z");

const executionApproval = {
  approvalId: "execution-002",
  approvedAt: "2026-10-26T20:04:00Z",
  approvedBy: "bevan",
};
let job = createExecutionJob(request.campaignId, executionApproval.approvedAt, executionApproval.approvedBy);
job = approveCampaign(job, executionApproval);
job = queueApprovedCampaign(job, "2026-10-26T20:05:00Z", "bevan");
job = markAdapterReady(job, "2026-10-26T20:06:00Z", "bevan");

const instruction = createAdapterInstruction(job, buildDistributionPlan(
  request.campaignId,
  "Optimized campaign",
  "Controlled optimization dispatch",
  ["linkedin"],
  "2026-10-26T20:10:00Z",
), "2026-10-26T20:06:00Z");

const ledger = new ExecutionLedger();
const receipt = dispatchOptimizationAttempt({
  executionId: "exec-002",
  optimization: request,
  instruction,
  network: "linkedin",
  scheduledAt: "2026-10-26T20:10:00Z",
  attempt: 1,
  recordedAt: "2026-10-26T20:06:30Z",
}, "retryable_failure", { maxAttempts: 3 }, ledger);

if (receipt.nextAction !== "retry") throw new Error("Retryable optimization dispatch must request retry");

let duplicateBlocked = false;
try {
  dispatchOptimizationAttempt({
    executionId: "exec-002",
    optimization: request,
    instruction,
    network: "linkedin",
    scheduledAt: "2026-10-26T20:10:00Z",
    attempt: 2,
    recordedAt: "2026-10-26T20:07:00Z",
  }, "success", { maxAttempts: 3 }, ledger);
} catch {
  duplicateBlocked = true;
}
if (!duplicateBlocked) throw new Error("Duplicate optimization dispatch was not blocked");

let lineageBlocked = false;
try {
  dispatchOptimizationAttempt({
    executionId: "exec-003",
    optimization: request,
    instruction: { ...instruction, approvalId: request.optimizationApprovalId },
    network: "linkedin",
    scheduledAt: "2026-10-26T20:11:00Z",
    attempt: 1,
    recordedAt: "2026-10-26T20:08:00Z",
  }, "success", { maxAttempts: 3 }, new ExecutionLedger());
} catch {
  lineageBlocked = true;
}
if (!lineageBlocked) throw new Error("Optimization approval was incorrectly accepted as execution approval");

console.log("IZAKHONO MARKETING OS optimization dispatch reliability validated");
