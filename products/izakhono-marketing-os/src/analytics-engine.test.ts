import { analyseCampaign } from "./analytics-engine";

const result = analyseCampaign({
  impressions: 10000,
  reach: 8000,
  engagements: 400,
  clicks: 250,
  leads: 50,
  conversions: 10,
  spend: 1000,
  revenue: 3000,
});

if (result.schema !== "izakhono.marketing.analytics.v1") throw new Error("Analytics schema missing");
if (result.score < 0 || result.score > 100) throw new Error("Analytics score out of range");
if (result.kpis.ctr !== 0.025) throw new Error("CTR calculation failed");
if (result.kpis.roas !== 3) throw new Error("ROAS calculation failed");
if (result.recommendations.length === 0) throw new Error("Recommendations missing");

console.log("IZAKHONO MARKETING OS analytics contract validated");
