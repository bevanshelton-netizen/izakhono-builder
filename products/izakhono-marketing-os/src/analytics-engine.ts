export interface CampaignMetrics {
  impressions: number;
  reach: number;
  engagements: number;
  clicks: number;
  leads: number;
  conversions: number;
  spend: number;
  revenue: number;
}

export interface AnalyticsResult {
  schema: "izakhono.marketing.analytics.v1";
  score: number;
  kpis: {
    engagementRate: number;
    ctr: number;
    cpc: number;
    cpa: number;
    conversionRate: number;
    roas: number;
  };
  recommendations: string[];
}

const safeRate = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 0;

export function analyseCampaign(metrics: CampaignMetrics): AnalyticsResult {
  const ctr = safeRate(metrics.clicks, metrics.impressions);
  const engagementRate = safeRate(metrics.engagements, metrics.reach);
  const cpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
  const cpa = metrics.conversions > 0 ? metrics.spend / metrics.conversions : 0;
  const conversionRate = safeRate(metrics.conversions, metrics.leads);
  const roas = metrics.spend > 0 ? metrics.revenue / metrics.spend : 0;

  let score = 0;
  score += Math.min(25, ctr * 2500);
  score += Math.min(20, engagementRate * 100);
  score += Math.min(25, conversionRate * 25);
  score += Math.min(30, roas * 10);
  score = Math.round(Math.min(100, score));

  const recommendations: string[] = [];
  if (ctr < 0.01) recommendations.push("Refresh the weakest hook and first-frame creative.");
  if (engagementRate < 0.03) recommendations.push("Test a stronger audience-specific creative angle.");
  if (conversionRate < 0.05) recommendations.push("Review the landing page, offer and CTA alignment.");
  if (roas < 1 && metrics.spend > 0) recommendations.push("Reduce inefficient spend and test a new offer or audience.");
  if (recommendations.length === 0) recommendations.push("Performance is healthy; scale the strongest creative carefully.");

  return {
    schema: "izakhono.marketing.analytics.v1",
    score,
    kpis: { engagementRate, ctr, cpc, cpa, conversionRate, roas },
    recommendations,
  };
}
