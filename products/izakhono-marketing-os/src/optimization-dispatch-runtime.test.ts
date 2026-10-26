import { buildDistributionPlan } from "./social-command";
import { deriveOptimizationSignal } from "./measurement-feedback";
import { approveOptimizationPlan, createOptimizationPlan } from "./optimization-orchestrator";
import { createOptimizationExecutionRequest, executeApprovedOptimization } from "./optimization-execution";
import { OptimizationDispatchRuntime } from "./optimization-dispatch-runtime";

const signal = deriveOptimizationSignal({ campaignId: "campaign-runtime-001", instructionApprovalId: "source-001", channel: "facebook", impressions: 10000, engagements: 500, conversions: 60, spend: 300, capturedAt: "2026-10-27T12:00:00+02:00" });
const plan = approveOptimizationPlan(createOptimizationPlan(signal, "source-001", "2026-10-27T12:01:00+02:00"), { approvalId: "opt-001", approvedAt: "2026-10-27T12:02:00+02:00", approvedBy: "Bevan Shelton" });
const request = createOptimizationExecutionRequest(plan, { approvalId: "opt-001", approvedAt: "2026-10-27T12:02:00+02:00", approvedBy: "Bevan Shelton" }, "2026-10-27T12:03:00+02:00");
const distribution = buildDistributionPlan(request.campaignId, "Runtime optimization", "Controlled dispatch", ["facebook"], "2026-10-27T12:15:00+02:00");
const execution = executeApprovedOptimization(request, { approvalId: "exec-001", approvedAt: "2026-10-27T12:04:00+02:00", approvedBy: "Bevan Shelton" }, distribution, "2026-10-27T12:05:00+02:00", "2026-10-27T12:06:00+02:00", "IZAKHONO MARKETING OS");
const runtime = new OptimizationDispatchRuntime();
const dispatch = { optimization: request, instruction: execution.instruction, network: "facebook", scheduledAt: "2026-10-27T12:15:00+02:00", executionId: "campaign-runtime-001:exec-001", attempt: 1, recordedAt: "2026-10-27T12:07:00+02:00" };
const first = runtime.dispatch(dispatch, "success", { maxAttempts: 3 });
if (first.receipt.nextAction !== "complete") throw new Error("Successful optimization dispatch must complete");
let duplicateBlocked = false;
try { runtime.dispatch(dispatch, "success", { maxAttempts: 3 }); } catch { duplicateBlocked = true; }
if (!duplicateBlocked) throw new Error("Duplicate optimization dispatch must be blocked");
let mismatchBlocked = false;
try { runtime.dispatch({ ...dispatch, network: "instagram" }, "success", { maxAttempts: 3 }); } catch { mismatchBlocked = true; }
if (!mismatchBlocked) throw new Error("Optimization dispatch network mismatch must be blocked");
console.log("IZAKHONO MARKETING OS optimization dispatch runtime validated");
