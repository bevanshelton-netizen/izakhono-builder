import { buildCampaignPackage } from "./campaign-engine";

const result = buildCampaignPackage({
  brand: "IZAKHONO",
  product: "Marketing OS",
  audience: "growing businesses",
  offer: "one system for creating and running campaigns",
  objective: "generate leads",
  channels: ["facebook", "instagram", "whatsapp", "google"],
  voice: "bold and trustworthy",
});

if (result.schema !== "izakhono.marketing.package.v1") throw new Error("schema mismatch");
if (result.status !== "draft") throw new Error("campaigns must start as drafts");
if (result.channelPlan.length !== 4) throw new Error("channel plan mismatch");
if (result.creative.variants.length < 3) throw new Error("creative variants missing");
if (!result.measurement.optimisationLoop.includes("Measure")) throw new Error("measurement loop missing");

console.log("IZAKHONO MARKETING OS campaign engine contract passed");
