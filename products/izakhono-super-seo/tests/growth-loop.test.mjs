import test from "node:test";
import assert from "node:assert/strict";
import { buildContentBrief, buildGrowthPlan, buildAttributionEvent, buildTrackingLinks } from "../growth-loop.mjs";

test("builds a commercial content brief with conversion event", () => {
  const brief = buildContentBrief({ query: "uniform supplier south africa", opportunity: 90 }, { domain: "izakhonoafrica.co.za" });
  assert.equal(brief.intent, "commercial");
  assert.equal(brief.status, "needs_review");
  assert.equal(brief.conversion_event, "lead_submit");
  assert.match(brief.target_url, /uniform-supplier-south-africa/);
});

test("ranks opportunities into an approval-gated growth plan", () => {
  const plan = buildGrowthPlan({ provider_status: "connected", opportunities: [
    { query: "low opportunity", opportunity: 30 },
    { query: "high opportunity", opportunity: 95 }
  ] }, { domain: "example.co.za", max_briefs: 1 });
  assert.equal(plan.schema, "izakhono.super-seo.growth.v4");
  assert.equal(plan.briefs.length, 1);
  assert.equal(plan.briefs[0].keyword, "high opportunity");
  assert.equal(plan.approval_required, true);
});

test("rejects invalid attribution revenue", () => {
  assert.throws(() => buildAttributionEvent({ lead_id: "lead-1", revenue: -1 }), /non-negative/);
});

test("creates explicit attribution events", () => {
  const event = buildAttributionEvent({ lead_id: "lead-1", event: "sale", revenue: 548, keyword: "business website", consent: true });
  assert.equal(event.revenue, 548);
  assert.equal(event.currency, "ZAR");
  assert.equal(event.consent, true);
});

test("builds measurable campaign links", () => {
  const url = buildTrackingLinks("https://example.co.za/insights/seo", { name: "seo-q4", term: "website builder" });
  assert.match(url, /utm_campaign=seo-q4/);
  assert.match(url, /utm_term=website\+builder/);
});
