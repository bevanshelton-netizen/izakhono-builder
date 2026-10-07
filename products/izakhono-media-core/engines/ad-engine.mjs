export function normalizeCampaign(campaign = {}) {
  return {
    id: String(campaign.id || "campaign"),
    name: String(campaign.name || campaign.id || "Campaign"),
    active: campaign.active !== false,
    weight: Math.max(0, Number(campaign.weight || 1)),
    starts_at: campaign.starts_at ? new Date(campaign.starts_at).toISOString() : null,
    ends_at: campaign.ends_at ? new Date(campaign.ends_at).toISOString() : null,
    asset_uri: String(campaign.asset_uri || ""),
    max_impressions: campaign.max_impressions == null ? null : Math.max(0, Number(campaign.max_impressions))
  };
}

export function selectAd({ campaigns = [], now = new Date(), impressions = {} } = {}) {
  const at = new Date(now).getTime();
  if (Number.isNaN(at)) throw new Error("now must be a valid date");
  const eligible = campaigns.map(normalizeCampaign).filter(c => {
    if (!c.active || !c.asset_uri) return false;
    if (c.starts_at && at < new Date(c.starts_at).getTime()) return false;
    if (c.ends_at && at >= new Date(c.ends_at).getTime()) return false;
    if (c.max_impressions != null && Number(impressions[c.id] || 0) >= c.max_impressions) return false;
    return true;
  });
  if (!eligible.length) return { campaign: null, reason: "no_eligible_campaign" };
  const total = eligible.reduce((sum, c) => sum + c.weight, 0);
  const seed = at % 1000003;
  let pick = total ? (seed / 1000003) * total : 0;
  for (const campaign of eligible) {
    pick -= campaign.weight;
    if (pick <= 0) return { campaign, reason: "weighted_selection" };
  }
  return { campaign: eligible[eligible.length - 1], reason: "weighted_selection" };
}
