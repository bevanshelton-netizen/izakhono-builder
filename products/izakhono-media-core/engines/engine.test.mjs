import test from "node:test";
import assert from "node:assert/strict";
import { buildPlayoutWindow, nextPlayoutItem } from "./playout-engine.mjs";
import { validateSchedule, toEpgXml } from "./epg-engine.mjs";
import { selectAd } from "./ad-engine.mjs";
import { normalizeEvent, summarizeEvents } from "./analytics-engine.mjs";
import { createOrder, verifyPayment, hasEntitlement } from "./monetization-engine.mjs";
import { createProvisioningJob, advanceProvisioning, isPublished } from "./provisioner-engine.mjs";
import { normalizeAsset } from "./content-engine.mjs";

test("playout cycles and supports fallback", () => {
  const playlist = [{ id: "a", title: "A", uri: "a.mp4", duration_seconds: 10 }, { id: "b", title: "B", uri: "b.mp4", duration_seconds: 20 }];
  assert.equal(nextPlayoutItem({ playlist, cursor: 0 }).item.id, "a");
  assert.equal(nextPlayoutItem({ playlist, cursor: 2 }).item.id, "a");
  assert.equal(nextPlayoutItem({ playlist: [], fallback: { title: "Slate", uri: "slate.mp4" } }).source, "fallback");
  assert.equal(buildPlayoutWindow({ playlist, maxItems: 3 }).length, 3);
});

test("EPG rejects overlaps and emits XML", () => {
  const schedule = [{ title: "News", start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" }];
  assert.equal(validateSchedule(schedule).length, 1);
  assert.match(toEpgXml({ channelId: "ch1", channelName: "IZAKHONO TV", schedule }), /IZAKHONO TV/);
  assert.throws(() => validateSchedule([{ start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" }, { start: "2026-01-01T10:30:00Z", end: "2026-01-01T12:00:00Z" }]), /overlapping/);
});

test("ad engine selects eligible campaign", () => {
  const result = selectAd({ campaigns: [{ id: "c1", asset_uri: "ad.mp4", weight: 1 }] });
  assert.equal(result.campaign.id, "c1");
});

test("analytics normalizes and summarizes events", () => {
  const events = [normalizeEvent({ type: "play_started", channel_id: "ch1" }), normalizeEvent({ type: "revenue_recorded", channel_id: "ch1", value: 250, currency: "ZAR" })];
  const summary = summarizeEvents(events);
  assert.equal(summary.events, 2);
  assert.equal(summary.revenue, 250);
  assert.equal(summary.channels.ch1, 2);
});

test("monetization gates entitlements on verified payment", () => {
  const order = createOrder({ customer_id: "cust1", plan: "pro", payment_reference: "pf-1" });
  assert.equal(hasEntitlement(order, "channel_live"), false);
  const paid = verifyPayment(order, { verified: true, reference: "pf-1" });
  assert.equal(hasEntitlement(paid, "channel_live"), true);
});

test("provisioner enforces ordered state transitions", () => {
  const paid = verifyPayment(createOrder({ customer_id: "cust1", plan: "starter" }), { verified: true });
  let job = createProvisioningJob(paid);
  assert.throws(() => advanceProvisioning(job, "published"), /before approved/);
  for (const step of ["channel_created", "storage_allocated", "domain_configured", "dns_configured", "tls_configured", "stream_health_verified", "approved", "published"]) job = advanceProvisioning(job, step);
  assert.equal(isPublished(job), true);
});

test("content engine normalizes assets", () => {
  const asset = normalizeAsset({ title: "Launch", uri: "s3://owned/launch.mp4", tags: ["promo"] });
  assert.equal(asset.status, "draft");
  assert.deepEqual(asset.tags, ["promo"]);
});
