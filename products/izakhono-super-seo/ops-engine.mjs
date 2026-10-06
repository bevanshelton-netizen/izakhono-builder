export {
  classifyIntent,
  buildOperations,
  approveOperation,
  buildManifest,
} from "./operations-engine.mjs";

export function buildGrowthQueue(opportunities = [], { domain, basePath = "/insights" } = {}) {
  const host = String(domain ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*/, "");
  if (!host) throw new Error("domain is required");
  if (!Array.isArray(opportunities)) throw new Error("opportunities must be an array");

  return opportunities
    .filter((x) => x && String(x.query ?? "").trim())
    .map((x, i) => {
      const query = String(x.query).trim().slice(0, 160);
      const opportunity = Number(x.opportunity) || 0;
      const intent = x.intent || "discovery";
      const commercial = intent === "commercial";
      const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return {
        id: `growth-${i + 1}`,
        query,
        opportunity,
        intent,
        priority: commercial ? "P1" : opportunity >= 70 ? "P2" : "P3",
        campaign_type: commercial ? "conversion" : "authority",
        target_url: `https://${host}${basePath}/${slug}`,
        primary_cta: commercial ? "request_quote_or_start" : "explore_related_solution",
        content_brief: {
          title: `${query.replace(/\b\w/g, (c) => c.toUpperCase())}: Practical Guide`,
          search_intent: intent,
          required_sections: commercial
            ? ["problem", "solution", "proof", "pricing_or_next_step", "faq"]
            : ["answer", "context", "examples", "faq", "next_step"],
          internal_link_target: `https://${host}/`,
          human_review_required: true,
        },
        publication: { status: "draft", approval_required: true, auto_publish: false },
        attribution: {
          utm_source: "organic",
          utm_medium: "seo",
          utm_campaign: `super-seo-${slug}`,
        },
      };
    })
    .sort((a, b) => b.opportunity - a.opportunity);
}

export function buildAttributionEvent(input = {}) {
  const type = String(input.event_type ?? "").trim();
  if (!["lead", "customer", "revenue"].includes(type)) {
    throw new Error("event_type must be lead, customer, or revenue");
  }
  const value = input.value == null ? null : Number(input.value);
  if (value !== null && !Number.isFinite(value)) throw new Error("value must be numeric");
  return {
    schema: "izakhono.super-seo.attribution.v1",
    event_id: String(input.event_id ?? "").trim() || crypto.randomUUID(),
    occurred_at: String(input.occurred_at ?? "").trim() || new Date().toISOString(),
    event_type: type,
    value,
    currency: String(input.currency ?? "").trim() || null,
    landing_path: String(input.landing_path ?? "").trim() || null,
    campaign: String(input.campaign ?? "").trim() || null,
    source: "first_party",
    consent_required: true,
  };
}

export function qualityGate({ title, body, hasHumanApproval = false, hasProductValue = false } = {}) {
  const text = String(body ?? "").trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const checks = {
    title_present: Boolean(String(title ?? "").trim()),
    substantive_content: words >= 500,
    human_approval: Boolean(hasHumanApproval),
    product_value: Boolean(hasProductValue),
  };
  const passed = Object.values(checks).every(Boolean);
  return { passed, checks, word_count: words, decision: passed ? "eligible_for_publish" : "hold_for_review" };
}

export function summarizeOps(queue = [], events = []) {
  const safeQueue = Array.isArray(queue) ? queue : [];
  const safeEvents = Array.isArray(events) ? events : [];
  const revenue = safeEvents
    .filter((e) => e?.event_type === "revenue")
    .reduce((n, e) => n + (Number(e.value) || 0), 0);
  return {
    schema: "izakhono.super-seo.ops.v1",
    generated_at: new Date().toISOString(),
    queue: {
      total: safeQueue.length,
      p1: safeQueue.filter((x) => x.priority === "P1").length,
      p2: safeQueue.filter((x) => x.priority === "P2").length,
      p3: safeQueue.filter((x) => x.priority === "P3").length,
    },
    attribution: {
      events: safeEvents.length,
      leads: safeEvents.filter((e) => e?.event_type === "lead").length,
      customers: safeEvents.filter((e) => e?.event_type === "customer").length,
      revenue,
      revenue_data_present: safeEvents.some((e) => e?.event_type === "revenue"),
    },
  };
}
