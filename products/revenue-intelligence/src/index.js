const DEFAULT_PRODUCTS = [
  { name: "FAISReady", url: "https://faisready-revenue.vercel.app/", revenueSignals: ["RE1", "RE3", "RE4", "RE5", "bundle", "employer"] },
  { name: "Allegro", url: "https://allegrovibez.com/", revenueSignals: ["advertising", "sponsorship", "artist promotion", "premium", "radio"] }
];

function products(env) {
  try {
    const configured = JSON.parse(env.REVENUE_PRODUCTS || "[]");
    if (Array.isArray(configured) && configured.length) return configured;
  } catch (_) {}
  return DEFAULT_PRODUCTS;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function auth(request, env) {
  if (!env.MONITOR_TOKEN) return true;
  return request.headers.get("authorization") === `Bearer ${env.MONITOR_TOKEN}`;
}

async function probe(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow" });
    return { url, ok: response.ok, status: response.status, latencyMs: Date.now() - started };
  } catch (error) {
    return { url, ok: false, status: 0, latencyMs: Date.now() - started, error: String(error) };
  }
}

function scoreOpportunity(product, title, detail) {
  const text = `${title} ${detail}`.toLowerCase();
  let score = 20;
  for (const signal of product.revenueSignals || []) if (text.includes(signal.toLowerCase())) score += 12;
  if (text.includes("deadline") || text.includes("closing")) score += 10;
  if (text.includes("sponsor") || text.includes("advertis")) score += 8;
  return Math.min(score, 100);
}

async function collect(env) {
  const checkedAt = new Date().toISOString();
  const configuredProducts = products(env);
  const health = await Promise.all(configuredProducts.map(async p => ({ product: p.name, ...(await probe(p.url)) })));
  const opportunities = [];

  let feeds = [];
  try { feeds = JSON.parse(env.REVENUE_SIGNAL_FEEDS || "[]"); } catch (_) {}
  if (!Array.isArray(feeds)) feeds = [];

  for (const feed of feeds.slice(0, 10)) {
    try {
      const r = await fetch(feed.url, { headers: { accept: "application/json, text/plain, application/rss+xml, application/xml" } });
      if (!r.ok) continue;
      const body = await r.text();
      for (const product of configuredProducts) {
        const score = scoreOpportunity(product, feed.title || feed.url, body.slice(0, 12000));
        if (score >= 44) opportunities.push({ product: product.name, score, title: feed.title || "Revenue signal", source: feed.url, detectedAt: checkedAt });
      }
    } catch (_) {}
  }

  const result = { version: "2", runtime: "izakhono-owned", checkedAt, health, opportunities: opportunities.sort((a, b) => b.score - a.score).slice(0, 25) };
  if (env.REVENUE_ALERT_WEBHOOK && opportunities.length) {
    try { await fetch(env.REVENUE_ALERT_WEBHOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(result) }); } catch (_) {}
  }
  return result;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const configuredProducts = products(env);
    if (url.pathname === "/health") return json({ service: "izakhono-revenue-intelligence", runtime: "izakhono-owned", products: configuredProducts.map(p => p.name) });
    if (url.pathname === "/opportunities") return json(await collect(env));
    if (url.pathname === "/run" && request.method === "POST") {
      if (!auth(request, env)) return json({ error: "unauthorized" }, 401);
      return json(await collect(env));
    }
    return json({ service: "izakhono-revenue-intelligence", endpoints: ["/health", "/opportunities", "/run"] });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(collect(env));
  }
};
