import {
  approveCampaign,
  createExecutionJob,
  markAdapterReady,
  queueApprovedCampaign,
} from "./execution-orchestrator";

const created = createExecutionJob(
  "campaign-001",
  "2026-10-27T08:00:00+02:00",
  "Bevan Shelton",
);

let blocked = false;
try {
  queueApprovedCampaign(created, "2026-10-27T08:01:00+02:00", "Bevan Shelton");
} catch {
  blocked = true;
}
if (!blocked) throw new Error("Unapproved campaign must not enter the queue");

const approved = approveCampaign(created, {
  approvalId: "approval-001",
  approvedAt: "2026-10-27T08:02:00+02:00",
  approvedBy: "Bevan Shelton",
});

const queued = queueApprovedCampaign(
  approved,
  "2026-10-27T08:03:00+02:00",
  "Bevan Shelton",
);

const ready = markAdapterReady(
  queued,
  "2026-10-27T08:04:00+02:00",
  "IZAKHONO MARKETING OS",
);

if (ready.state !== "ready_for_adapter") throw new Error("Expected adapter-ready state");
if (!ready.approval) throw new Error("Approval record must be retained");
if (ready.audit.length !== 4) throw new Error("Expected complete four-event audit trail");
if (ready.audit.map((event) => event.state).join(",") !== "draft,approved,queued,ready_for_adapter") {
  throw new Error("Unexpected campaign state sequence");
}

console.log("IZAKHONO MARKETING OS execution orchestration contract validated");
