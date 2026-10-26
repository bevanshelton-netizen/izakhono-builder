import { buildDistributionPlan, validateDistributionPlan } from "./social-command";

const plan = buildDistributionPlan(
  "campaign-001",
  "Launch your next campaign",
  "Turn one product brief into a complete marketing system.",
  ["facebook", "instagram", "linkedin", "whatsapp"],
  "2026-10-27T09:00:00+02:00",
);

validateDistributionPlan(plan);
if (plan.jobs.length !== 4) throw new Error("Expected four distribution jobs");
if (plan.approvalRequired !== true) throw new Error("Approval gate must be enabled");
if (plan.adapter !== "metricool") throw new Error("Metricool adapter boundary missing");
if (!plan.jobs.every((job) => job.status === "ready_for_adapter")) throw new Error("Jobs must be adapter-ready");

console.log("IZAKHONO MARKETING OS Social Command contract validated");
