import { createMarketingExecution, executeApprovedMarketingCampaign } from "./execution-pipeline";

const initial = createMarketingExecution(
  "campaign-001",
  "Launch your next campaign",
  "Turn one product brief into a complete marketing system.",
  ["facebook", "instagram", "linkedin", "whatsapp"],
  "2026-10-27T09:00:00+02:00",
  "2026-10-26T18:45:00+02:00",
);

if (initial.job.state !== "draft") throw new Error("Execution must begin in draft");
if (!initial.distribution.jobs.every((job) => job.status === "draft")) {
  throw new Error("Distribution jobs must begin in draft");
}

const completed = executeApprovedMarketingCampaign(
  initial,
  "approval-001",
  "2026-10-26T18:46:00+02:00",
  "Bevan Shelton",
  "2026-10-26T18:47:00+02:00",
  "2026-10-26T18:48:00+02:00",
);

if (completed.job.state !== "ready_for_adapter") throw new Error("Execution pipeline did not reach adapter-ready state");
if (!completed.job.approval) throw new Error("Approval record missing");
if (completed.distribution.jobs.length !== 4) throw new Error("Expected four distribution jobs");
if (!completed.distribution.jobs.every((job) => job.status === "ready_for_adapter")) {
  throw new Error("All jobs must be adapter-ready");
}
if (completed.job.audit.length !== 4) throw new Error("Expected creation, approval, queue and adapter-ready audit events");

console.log("IZAKHONO MARKETING OS end-to-end execution pipeline validated");
