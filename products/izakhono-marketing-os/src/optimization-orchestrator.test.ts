import { deriveOptimizationSignal } from "./measurement-feedback";
import { approveOptimizationPlan, createOptimizationPlan, validateOptimizationPlan } from "./optimization-orchestrator";

const signal = deriveOptimizationSignal({
  campaignId: "campaign-opt-001",
  instructionApprovalId: "approval-exec-001",
  channel: "facebook",
  impressions: 10000,
  engagements: 500,
  conversions: 60,
  spend: 300,
  capturedAt: "2026-10-27T12:00:00+02:00",
});

const plan = createOptimizationPlan(signal, "approval-exec-001", "2026-10-27T12:05:00+02:00");
validateOptimizationPlan(plan);
if (plan.action !== "scale") throw new Error("Expected scale optimization action");
if (plan.status !== "proposed") throw new Error("Optimization plan must start proposed");

const approved = approveOptimizationPlan(plan, {
  approvalId: "approval-opt-001",
  approvedAt: "2026-10-27T12:06:00+02:00",
  approvedBy: "Bevan Shelton",
});
validateOptimizationPlan(approved);
if (approved.status !== "approved") throw new Error("Optimization plan approval failed");

let blocked = false;
try {
  approveOptimizationPlan(plan, {
    approvalId: "approval-exec-001",
    approvedAt: "2026-10-27T12:06:00+02:00",
    approvedBy: "Bevan Shelton",
  });
} catch {
  blocked = true;
}
if (!blocked) throw new Error("Optimization must require a distinct approval record");

console.log("IZAKHONO MARKETING OS optimization orchestration contract validated");
