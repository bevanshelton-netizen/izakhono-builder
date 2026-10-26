import { buildDistributionPlan } from "./social-command";
import { deriveOptimizationSignal } from "./measurement-feedback";
import { approveOptimizationPlan, createOptimizationPlan } from "./optimization-orchestrator";
import { createOptimizationExecutionRequest, executeApprovedOptimization } from "./optimization-execution";

const signal = deriveOptimizationSignal({ campaignId: "campaign-loop-001", instructionApprovalId: "approval-exec-original", channel: "facebook", impressions: 10000, engagements: 500, conversions: 60, spend: 300, capturedAt: "2026-10-27T12:00:00+02:00" });
const plan = createOptimizationPlan(signal, "approval-exec-original", "2026-10-27T12:05:00+02:00");
const optimizationApproval = { approvalId: "approval-optimization-001", approvedAt: "2026-10-27T12:06:00+02:00", approvedBy: "Bevan Shelton" };
const approvedPlan = approveOptimizationPlan(plan, optimizationApproval);
const request = createOptimizationExecutionRequest(approvedPlan, optimizationApproval, "2026-10-27T12:07:00+02:00");
const distribution = buildDistributionPlan(request.campaignId, "Controlled optimization", "Approved optimization loop execution", ["facebook"], "2026-10-27T12:15:00+02:00");
const result = executeApprovedOptimization(request, { approvalId: "approval-execution-002", approvedAt: "2026-10-27T12:08:00+02:00", approvedBy: "Bevan Shelton" }, distribution, "2026-10-27T12:09:00+02:00", "2026-10-27T12:10:00+02:00", "IZAKHONO MARKETING OS");
if (result.job.state !== "ready_for_adapter") throw new Error("Optimization execution did not reach adapter-ready state");
if (result.instruction.approvalId !== "approval-execution-002") throw new Error("Execution approval lineage was not preserved");
if (result.instruction.jobs.length !== 1) throw new Error("Expected one controlled optimization distribution job");
let blocked = false;
try { executeApprovedOptimization(request, optimizationApproval, distribution, "2026-10-27T12:09:00+02:00", "2026-10-27T12:10:00+02:00", "IZAKHONO MARKETING OS"); } catch { blocked = true; }
if (!blocked) throw new Error("Optimization approval cannot be reused as execution approval");
let mismatchBlocked = false;
try { executeApprovedOptimization(request, { approvalId: "approval-execution-003", approvedAt: "2026-10-27T12:08:00+02:00", approvedBy: "Bevan Shelton" }, { ...distribution, jobs: [{ ...distribution.jobs[0], campaignId: "other-campaign" }] }, "2026-10-27T12:09:00+02:00", "2026-10-27T12:10:00+02:00", "IZAKHONO MARKETING OS"); } catch { mismatchBlocked = true; }
if (!mismatchBlocked) throw new Error("Optimization execution must reject campaign-mismatched distribution");
console.log("IZAKHONO MARKETING OS closed-loop optimization execution contract validated");
