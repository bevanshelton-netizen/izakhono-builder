export type SocialNetwork = "facebook" | "instagram" | "tiktok" | "youtube" | "linkedin" | "whatsapp";

export interface DistributionJob {
  campaignId: string;
  network: SocialNetwork;
  text: string;
  scheduledAt: string;
  status: "draft" | "queued" | "ready_for_adapter";
}

export interface DistributionPlan {
  schema: "izakhono.marketing.distribution.v1";
  source: "IZAKHONO MARKETING OS";
  approvalRequired: true;
  jobs: DistributionJob[];
  adapter: "metricool" | "owned";
}

const networkCopy: Record<SocialNetwork, string> = {
  facebook: "Facebook campaign post",
  instagram: "Instagram campaign post",
  tiktok: "TikTok short-form campaign post",
  youtube: "YouTube campaign description",
  linkedin: "LinkedIn campaign post",
  whatsapp: "WhatsApp direct-response message",
};

export function buildDistributionPlan(
  campaignId: string,
  headline: string,
  primaryCopy: string,
  networks: SocialNetwork[],
  scheduledAt: string,
): DistributionPlan {
  return {
    schema: "izakhono.marketing.distribution.v1",
    source: "IZAKHONO MARKETING OS",
    approvalRequired: true,
    adapter: "metricool",
    jobs: networks.map((network) => ({
      campaignId,
      network,
      text: `${headline}\n\n${primaryCopy}\n\n${networkCopy[network]}`,
      scheduledAt,
      status: "ready_for_adapter",
    })),
  };
}

export function validateDistributionPlan(plan: DistributionPlan): void {
  if (plan.schema !== "izakhono.marketing.distribution.v1") throw new Error("Invalid distribution schema");
  if (plan.source !== "IZAKHONO MARKETING OS") throw new Error("Invalid distribution source");
  if (!plan.approvalRequired) throw new Error("External publishing requires approval");
  for (const job of plan.jobs) {
    if (!job.campaignId || !job.network || !job.scheduledAt) throw new Error("Incomplete distribution job");
    if (!["ready_for_adapter", "queued", "draft"].includes(job.status)) throw new Error("Invalid distribution status");
  }
}
