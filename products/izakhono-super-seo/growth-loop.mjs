const clean = (v, n = 500) => String(v ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, n);
const slug = (v) => clean(v, 180).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const COMMERCIAL = /price|cost|quote|supplier|buy|service|company|provider|course|training|hosting|email|repair|software|consult/i;
const INFORMATIONAL = /how|what|why|guide|tips|requirements|learn|compare|checklist/i;

export function classifyIntent(keyword = "") {
  if (COMMERCIAL.test(keyword)) return "commercial";
  if (INFORMATIONAL.test(keyword)) return "informational";
  return "discovery";
}

export function buildContentBrief(opportunity, options = {}) {
  const keyword = clean(opportunity?.query || opportunity?.keyword, 160);
  if (!keyword) throw new Error("keyword/query is required");
  const domain = clean(options.domain, 180).replace(/^https?:\/\//, "").replace(/\/.*/, "");
  if (!domain) throw new Error("domain is required");
  const intent = opportunity.intent || classifyIntent(keyword);
  const target = `https://${domain}/insights/${slug(keyword)}`;
  const cta = intent === "commercial" ? (options.commercial_cta || "Request a quote / start now") : (options.informational_cta || "Explore the related service or guide");
  return {
    id: `brief-${slug(keyword)}`,
    status: "needs_review",
    keyword,
    intent,
    target_url: target,
    title: clean(options.title || `${keyword.replace(/\b\w/g, c => c.toUpperCase())}: Practical Guide`, 180),
    meta_description: clean(`A practical ${intent} guide to ${keyword}, with clear next steps and useful resources.`, 160),
    audience: clean(options.audience || "People actively researching or buying this solution", 180),
    word_count: intent === "commercial" ? 1300 : 1500,
    outline: [
      `What ${keyword} means and why it matters`,
      `Key considerations when choosing ${keyword}`,
      `Common mistakes and how to avoid them`,
      `Practical next steps`,
      `Frequently asked questions`
    ],
    internal_link_targets: Array.isArray(options.internal_link_targets) ? options.internal_link_targets.slice(0, 8) : [`https://${domain}/`],
    cta,
    conversion_event: "lead_submit",
    guardrails: [
      "Human/product-value review required before publication.",
      "Do not publish mass low-value pages.",
      "Do not make unsupported ranking, traffic, or revenue claims.",
      "Do not generate or exchange backlinks automatically."
    ]
  };
}

export function buildGrowthPlan(searchResult, options = {}) {
  const opportunities = Array.isArray(searchResult?.opportunities) ? searchResult.opportunities : [];
  const ranked = opportunities.filter(x => x && (x.query || x.keyword)).sort((a, b) => Number(b.opportunity || 0) - Number(a.opportunity || 0));
  const max = Math.min(20, Math.max(1, Number(options.max_briefs) || 10));
  const briefs = ranked.slice(0, max).map(x => buildContentBrief(x, options));
  return {
    schema: "izakhono.super-seo.growth.v4",
    generated_at: new Date().toISOString(),
    provider_status: searchResult?.provider_status || "unknown",
    opportunities_considered: ranked.length,
    briefs,
    conversion_funnel: {
      discovery: "search opportunity",
      consideration: "approved content or landing page",
      conversion: "lead_submit",
      revenue: "attributed revenue event"
    },
    approval_required: true,
    next_actions: ["review_briefs", "approve_pages", "publish", "capture_leads", "attribute_revenue"]
  };
}

export function buildAttributionEvent(input = {}) {
  const leadId = clean(input.lead_id, 120);
  const event = clean(input.event || "lead_submit", 80);
  if (!leadId) throw new Error("lead_id is required");
  if (!event) throw new Error("event is required");
  const revenue = input.revenue == null ? null : Number(input.revenue);
  if (revenue !== null && (!Number.isFinite(revenue) || revenue < 0)) throw new Error("revenue must be a non-negative number");
  return {
    schema: "izakhono.super-seo.attribution.v1",
    event_id: clean(input.event_id || `evt-${Date.now()}`, 120),
    occurred_at: clean(input.occurred_at || new Date().toISOString(), 60),
    lead_id: leadId,
    event,
    revenue,
    currency: clean(input.currency || "ZAR", 10),
    source: clean(input.source || "organic", 40),
    campaign: clean(input.campaign || "", 120),
    keyword: clean(input.keyword || "", 160),
    landing_page: clean(input.landing_page || "", 500),
    consent: input.consent === true
  };
}

export function buildTrackingLinks(baseUrl, campaign = {}) {
  const u = new URL(baseUrl);
  const fields = {
    utm_source: campaign.source || "google",
    utm_medium: campaign.medium || "organic",
    utm_campaign: campaign.name || "seo",
    utm_content: campaign.content || "super-seo",
    utm_term: campaign.term || ""
  };
  for (const [k, v] of Object.entries(fields)) if (v) u.searchParams.set(k, clean(v, 160));
  return u.toString();
}
