export type CampaignRequest = {
  brand: string;
  product: string;
  audience: string;
  offer: string;
  objective?: "awareness" | "leads" | "sales" | "retention";
  channel?: string;
  voice?: string;
};

const hooks = [
  "Problem → solution",
  "Bold offer",
  "Social proof",
  "Urgency",
  "Lifestyle",
  "Authority",
  "Storytelling",
  "African-first"
] as const;

function scoreAd(input: CampaignRequest) {
  const text = `${input.product} ${input.audience} ${input.offer}`.trim();
  const completeness = [input.brand, input.product, input.audience, input.offer].filter(Boolean).length * 12;
  const specificity = Math.min(20, Math.round(text.length / 12));
  const action = /buy|book|quote|order|apply|register|call|whatsapp|learn|shop/i.test(input.offer) ? 15 : 6;
  const audience = input.audience.length >= 12 ? 12 : 6;
  return Math.min(100, completeness + specificity + action + audience + 10);
}

export function buildCampaign(input: CampaignRequest) {
  const objective = input.objective ?? "sales";
  const channel = input.channel ?? "Facebook + Instagram";
  const voice = input.voice ?? "confident, direct and conversion-focused";
  const score = scoreAd(input);
  const headline = `${input.product}: ${input.offer}`;
  const body = `Built for ${input.audience}. ${input.product} gives you a clear reason to act now — without wasting your marketing budget.`;
  const cta = /whatsapp/i.test(input.offer) ? "WHATSAPP NOW" : objective === "leads" ? "GET STARTED" : "BUY NOW";

  return {
    level: "Campaign Engine",
    objective,
    channel,
    voice,
    hook: hooks[score % hooks.length],
    headline,
    primaryCopy: body,
    cta,
    adStrength: score,
    deliverables: [
      "Primary ad",
      "3 headline variants",
      "3 CTA variants",
      "Short-form social version",
      "WhatsApp version",
      "Retargeting variant",
      "Landing-page brief",
      "Measurement plan"
    ],
    funnel: ["AD", "LANDING PAGE", "LEAD", "CRM", "WHATSAPP", "PAYMENT", "CUSTOMER", "ANALYTICS"]
  };
}

export function metricoolAdapterConfig() {
  return {
    provider: "metricool",
    mode: "adapter",
    brandLabel: "Shelton Marketing",
    brandId: 7233518,
    timezone: "Africa/Johannesburg",
    connectedNetworks: ["facebook", "instagram"],
    principle: "Metricool is a distribution/analytics adapter; IZAKHONO remains the system of record."
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const headers = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" };

    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (url.pathname === "/marketing-os/health") {
      return new Response(JSON.stringify({ ok: true, product: "IZAKHONO MARKETING OS", architecture: "owned-first", primary: "IZAKHONO infrastructure", security: "FORTRESS" }), { headers });
    }
    if (url.pathname === "/marketing-os/metricool") {
      return new Response(JSON.stringify(metricoolAdapterConfig()), { headers });
    }
    if (url.pathname === "/marketing-os/campaign" && request.method === "POST") {
      const input = await request.json() as CampaignRequest;
      return new Response(JSON.stringify(buildCampaign(input)), { headers });
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
  }
};
