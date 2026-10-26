import { strict as assert } from "node:assert";
import { buildCampaign, metricoolAdapterConfig } from "./index";

const result = buildCampaign({
  brand: "IZAKHONO",
  product: "AD MAKER",
  audience: "South African business owners",
  offer: "Get your campaign built and launched",
  objective: "sales",
  channel: "Facebook + Instagram",
  voice: "bold, direct and premium"
});

assert.equal(result.level, "Campaign Engine");
assert.ok(result.adStrength >= 0 && result.adStrength <= 100);
assert.ok(result.funnel.includes("PAYMENT"));
assert.equal(metricoolAdapterConfig().timezone, "Africa/Johannesburg");
console.log("IZAKHONO MARKETING OS tests passed");
