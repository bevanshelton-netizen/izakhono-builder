import { buildMarketingAgentPlan, validateMarketingAgentPlan } from "./ai-marketing-agent";

const plan = buildMarketingAgentPlan({
  campaignId: "camp-001",
  product: "IZAKHONO Hoodie",
  audience: "young African urban consumers",
  offer: "launch special",
  objective: "sales",
  channels: ["instagram", "facebook", "whatsapp"],
});

if (plan.actions.length !== 6) throw new Error("Expected six orchestration stages");
if (plan.executionMode !== "approval_gated") throw new Error("Expected approval-gated execution");
if (!validateMarketingAgentPlan(plan)) throw new Error("Expected valid marketing agent plan");

const distribution = plan.actions.find((action) => action.stage === "distribution");
if (!distribution?.approvalRequired) throw new Error("Distribution must require approval");
if (distribution.status !== "ready_for_approval") throw new Error("Distribution should be approval-ready");
