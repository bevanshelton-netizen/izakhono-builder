export type MarketingChannel =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "whatsapp"
  | "google"
  | "radio"
  | "print";

export interface CampaignBrief {
  brand: string;
  product: string;
  audience: string;
  offer: string;
  objective: string;
  channels: MarketingChannel[];
  voice?: string;
}

export interface CampaignPackage {
  schema: "izakhono.marketing.package.v1";
  source: "IZAKHONO MARKETING OS";
  status: "draft";
  strategy: {
    positioning: string;
    corePromise: string;
    hook: string;
    funnel: string[];
  };
  creative: {
    headline: string;
    primaryCopy: string;
    cta: string;
    variants: Array<{ angle: string; headline: string; cta: string }>;
  };
  channelPlan: Array<{ channel: MarketingChannel; role: string; asset: string }>;
  measurement: {
    primaryMetric: string;
    secondaryMetrics: string[];
    optimisationLoop: string[];
  };
}

const channelRoles: Record<MarketingChannel, string> = {
  facebook: "Reach and conversion",
  instagram: "Visual discovery and conversion",
  tiktok: "Short-form discovery",
  youtube: "Video education and demand capture",
  linkedin: "Professional trust and B2B demand",
  whatsapp: "Direct response and follow-up",
  google: "Intent capture",
  radio: "Mass awareness and recall",
  print: "Physical visibility and local trust",
};

export function buildCampaignPackage(brief: CampaignBrief): CampaignPackage {
  const voice = brief.voice?.trim() || "confident, clear and human";
  const headline = `${brief.product}: ${brief.offer}`;
  const primaryCopy = `${brief.audience}, meet ${brief.product}. ${brief.offer}. Built around one clear outcome: ${brief.objective}. ${voice}.`;
  const cta = brief.objective.toLowerCase().includes("lead") ? "Get started" : "Act now";

  return {
    schema: "izakhono.marketing.package.v1",
    source: "IZAKHONO MARKETING OS",
    status: "draft",
    strategy: {
      positioning: `${brief.brand} gives ${brief.audience} a clear reason to choose ${brief.product}.`,
      corePromise: brief.offer,
      hook: `${brief.product} + ${brief.offer}`,
      funnel: ["Attention", "Interest", "Proof", "Action", "Follow-up", "Measurement"],
    },
    creative: {
      headline,
      primaryCopy,
      cta,
      variants: [
        { angle: "Problem → solution", headline: `${brief.product} solves the problem.`, cta },
        { angle: "Offer", headline: `${brief.offer} — now is the time.`, cta: "Claim offer" },
        { angle: "Authority", headline: `Choose ${brief.brand} for ${brief.product}.`, cta: "Learn more" },
      ],
    },
    channelPlan: brief.channels.map((channel) => ({
      channel,
      role: channelRoles[channel],
      asset: channel === "radio" ? "30-second audio script" : channel === "whatsapp" ? "Direct-response message" : "Primary creative + CTA variant",
    })),
    measurement: {
      primaryMetric: brief.objective.toLowerCase().includes("sale") ? "Conversions" : "Qualified actions",
      secondaryMetrics: ["CTR", "CPC", "CPA", "Engagement rate", "Conversion rate", "Revenue"],
      optimisationLoop: ["Launch", "Measure", "Score creative", "Shift budget", "Refresh weakest variant", "Repeat"],
    },
  };
}
