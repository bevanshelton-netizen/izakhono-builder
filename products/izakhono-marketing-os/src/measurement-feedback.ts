import type { AdapterInstruction } from "./adapter-execution";

export interface CampaignResult {
  campaignId: string;
  instructionApprovalId: string;
  channel: string;
  impressions: number;
  engagements: number;
  conversions: number;
  spend: number;
  capturedAt: string;
}

export interface OptimizationSignal {
  campaignId: string;
  channel: string;
  engagementRate: number;
  conversionRate: number;
  costPerConversion: number | null;
  recommendation: "scale" | "maintain" | "improve" | "pause";
}

export function recordCampaignResult(
  instruction: AdapterInstruction,
  result: CampaignResult,
): CampaignResult {
  if (result.campaignId !== instruction.campaignId) {
    throw new Error("Campaign result does not match adapter instruction");
  }
  if (result.instructionApprovalId !== instruction.approvalId) {
    throw new Error("Campaign result approval mismatch");
  }
  if (result.impressions < 0 || result.engagements < 0 || result.conversions < 0 || result.spend < 0) {
    throw new Error("Campaign metrics cannot be negative");
  }
  if (result.engagements > result.impressions) throw new Error("Engagements cannot exceed impressions");
  if (result.conversions > result.engagements) throw new Error("Conversions cannot exceed engagements");
  return { ...result };
}

export function deriveOptimizationSignal(result: CampaignResult): OptimizationSignal {
  const engagementRate = result.impressions === 0 ? 0 : result.engagements / result.impressions;
  const conversionRate = result.engagements === 0 ? 0 : result.conversions / result.engagements;
  const costPerConversion = result.conversions === 0 ? null : result.spend / result.conversions;

  let recommendation: OptimizationSignal["recommendation"] = "maintain";
  if (result.impressions === 0) recommendation = "improve";
  else if (conversionRate >= 0.08 && engagementRate >= 0.03) recommendation = "scale";
  else if (conversionRate < 0.01 && engagementRate < 0.01) recommendation = "pause";
  else if (conversionRate < 0.03 || engagementRate < 0.02) recommendation = "improve";

  return {
    campaignId: result.campaignId,
    channel: result.channel,
    engagementRate,
    conversionRate,
    costPerConversion,
    recommendation,
  };
}
