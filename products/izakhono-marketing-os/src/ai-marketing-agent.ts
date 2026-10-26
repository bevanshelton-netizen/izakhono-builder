export type AgentObjective = "awareness" | "leads" | "sales" | "engagement" | "retention";
export type AgentStage = "strategy" | "creative" | "campaign" | "distribution" | "measurement" | "optimisation";

export interface MarketingBrief {
  campaignId: string;
  product: string;
  audience: string;
  offer?: string;
  objective: AgentObjective;
  channels: string[];
  budget?: number;
  brandVoice?: string;
}

export interface AgentAction {
  stage: AgentStage;
  action: string;
  status: "planned" | "ready_for_approval" | "executed";
  approvalRequired: boolean;
}

export interface MarketingAgentPlan {
  schema: "izakhono.marketing.agent.v1";
  source: "IZAKHONO MARKETING OS";
  campaignId: string;
  objective: AgentObjective;
  actions: AgentAction[];
  executionMode: "approval_gated";
}

const actionsFor = (brief: MarketingBrief): AgentAction[] => [
  { stage: "strategy", action: `Define positioning, audience segments and offer for ${brief.product}.`, status: "planned", approvalRequired: false },
  { stage: "creative", action: "Generate channel-specific hooks, copy, concepts and variants.", status: "planned", approvalRequired: false },
  { stage: "campaign", action: "Assemble the funnel, campaign structure, CTA and measurement plan.", status: "planned", approvalRequired: false },
  { stage: "distribution", action: `Prepare approved-ready distribution for: ${brief.channels.join(", ")}.`, status: "ready_for_approval", approvalRequired: true },
  { stage: "measurement", action: "Collect performance metrics and calculate campaign KPIs.", status: "planned", approvalRequired: false },
  { stage: "optimisation", action: "Score performance and recommend creative, audience, offer and budget changes.", status: "planned", approvalRequired: false },
];

export function buildMarketingAgentPlan(brief: MarketingBrief): MarketingAgentPlan {
  if (!brief.campaignId || !brief.product || !brief.audience || brief.channels.length === 0) {
    throw new Error("campaignId, product, audience and at least one channel are required");
  }

  return {
    schema: "izakhono.marketing.agent.v1",
    source: "IZAKHONO MARKETING OS",
    campaignId: brief.campaignId,
    objective: brief.objective,
    actions: actionsFor(brief),
    executionMode: "approval_gated",
  };
}

export function validateMarketingAgentPlan(plan: MarketingAgentPlan): boolean {
  return plan.schema === "izakhono.marketing.agent.v1"
    && plan.source === "IZAKHONO MARKETING OS"
    && plan.executionMode === "approval_gated"
    && plan.actions.length === 6
    && plan.actions.some((action) => action.stage === "distribution" && action.approvalRequired && action.status === "ready_for_approval");
}
