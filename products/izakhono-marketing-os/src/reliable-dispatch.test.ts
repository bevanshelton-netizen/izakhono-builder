import { buildDistributionPlan } from "./social-command";
import { approveCampaign, createExecutionJob, markAdapterReady, queueApprovedCampaign } from "./execution-orchestrator";
import { createAdapterInstruction } from "./adapter-execution";
import { ExecutionLedger } from "./execution-reliability";
import { dispatchAttempt } from "./reliable-dispatch";

const created = createExecutionJob("campaign-reliable-001", "2026-10-27T08:00:00+02:00", "Bevan Shelton");
const approved = approveCampaign(created, {
  approvalId: "approval-reliable-001",
  approvedAt: "2026-10-27T08:02:00+02:00",
  approvedBy: "Bevan Shelton",
});
const queued = queueApprovedCampaign(approved, "2026-10-27T08:03:00+02:00", "Bevan Shelton");
const ready = markAdapterReady(queued, "2026-10-27T08:04:00+02:00", "IZAKHONO MARKETING OS");

const distribution = buildDistributionPlan(
  "campaign-reliable-001",
  "Reliable launch",
  "Execute exactly once at the adapter boundary.",
  ["facebook"],
  "2026-10-27T09:00:00+02:00",
);
const instruction = createAdapterInstruction(ready, distribution, "2026-10-27T08:05:00+02:00");
const ledger = new ExecutionLedger();
const policy = { maxAttempts: 3 };
const request = {
  executionId: "execution-reliable-001",
  instruction,
  network: "facebook",
  scheduledAt: "2026-10-27T09:00:00+02:00",
  attempt: 1,
  recordedAt: "2026-10-27T08:06:00+02:00",
};

const first = dispatchAttempt(request, "retryable_failure", policy, ledger);
if (first.duplicate) throw new Error("First dispatch must not be marked duplicate");
if (first.receipt.nextAction !== "retry") throw new Error("Retryable failure must request retry");

let duplicateBlocked = false;
try {
  dispatchAttempt(request, "success", policy, ledger);
} catch {
  duplicateBlocked = true;
}
if (!duplicateBlocked) throw new Error("Duplicate execution must be blocked");

const final = dispatchAttempt(
  { ...request, network: "instagram", attempt: 3, recordedAt: "2026-10-27T08:07:00+02:00" },
  "retryable_failure",
  policy,
  ledger,
);
if (final.receipt.nextAction !== "dead_letter") throw new Error("Exhausted retries must dead-letter");

console.log("IZAKHONO MARKETING OS reliable dispatch contract validated");
