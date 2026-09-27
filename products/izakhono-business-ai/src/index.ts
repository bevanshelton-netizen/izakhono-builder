interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: Fetcher;
  APP_ENV?: string;
  AI_GATEWAY_URL?: string;
  AI_GATEWAY_TOKEN?: string;
}

type JsonObject = Record<string, unknown>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer"
    }
  });
}

function clean(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clampScore(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

async function parseBody(req: Request): Promise<JsonObject> {
  const type = req.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error("Expected application/json");
  const body = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request body");
  return body as JsonObject;
}

function fallbackDraft(purpose: string, tone: string, context: string): string {
  const intro = tone.toLowerCase().includes("friendly")
    ? "Hello,\n\nI hope you are well."
    : "Good day,\n\nThank you for your time.";

  const asks: Record<string, string> = {
    "Quote follow-up": "I am following up on the quotation we shared and would appreciate an update on whether you would like us to proceed.",
    "Payment reminder": "This is a courteous reminder regarding the outstanding payment. Please let us know if you need the invoice resent or if there is anything we should clarify.",
    "Proposal introduction": "I am pleased to share our proposal and would welcome the opportunity to discuss how we can support your requirements.",
    "Client update": "I am writing to keep you updated on the current status and the next steps.",
    "Apology and resolution": "I am sorry for the inconvenience caused. We take the matter seriously and want to resolve it promptly.",
    "General business email": "I am writing regarding the matter below and would appreciate your feedback."
  };

  const main = asks[purpose] || asks["General business email"];
  const contextLine = context ? "\n\nContext: " + context : "";
  return intro + "\n\n" + main + contextLine + "\n\nPlease let me know how you would like to proceed.\n\nKind regards";
}

async function callAiGateway(env: Env, task: string, input: JsonObject): Promise<string | null> {
  if (!env.AI_GATEWAY_URL) return null;

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (env.AI_GATEWAY_TOKEN) headers.authorization = "Bearer " + env.AI_GATEWAY_TOKEN;

  try {
    const res = await fetch(env.AI_GATEWAY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        capability: "chat",
        task,
        privacy: {
          raw_prompt_persistence: false,
          behavioural_tracking: false
        },
        input
      })
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const candidates = [data.output, data.text, data.answer, data.content];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  } catch {
    return null;
  }
}

function diagnostic(body: JsonObject) {
  const scores = {
    leads: clampScore(body.leads),
    followup: clampScore(body.followup),
    cash: clampScore(body.cash),
    admin: clampScore(body.admin)
  };
  const weighted = Math.round(
    scores.leads * 0.30 +
    scores.followup * 0.25 +
    scores.cash * 0.25 +
    scores.admin * 0.20
  );

  const ordered = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const labels: Record<string, string> = {
    leads: "lead generation",
    followup: "quote and client follow-up",
    cash: "cash visibility",
    admin: "administrative control"
  };

  const actions = ordered.slice(0, 3).map(function(entry) {
    const key = entry[0];
    if (key === "leads") return "Build one repeatable weekly lead-generation routine and measure enquiries by source.";
    if (key === "followup") return "Create a fixed follow-up schedule for every open quote until it is won, lost or postponed.";
    if (key === "cash") return "Update expected receipts and committed expenses at least weekly so cash decisions use current numbers.";
    return "Standardise recurring admin into checklists, templates and automated reminders.";
  });

  let headline = "Strengthen the operating basics.";
  if (weighted >= 80) headline = "Strong operating foundation — focus on scale and consistency.";
  else if (weighted >= 60) headline = "Good base with a few clear growth constraints.";
  else if (weighted >= 40) headline = "Several operating gaps are limiting growth.";
  else headline = "Stabilise the business systems before adding complexity.";

  return { ok: true, score: weighted, headline, actions, weakest: labels[ordered[0][0]] };
}

function scenarioReport(body: JsonObject) {
  const scenario = clean(body.scenario, 3000);
  const horizon = clean(body.horizon, 80) || "90 days";
  const incoming = Array.isArray(body.stakeholders) ? body.stakeholders : [];
  const stakeholders = incoming
    .map(function(v) { return clean(v, 80); })
    .filter(Boolean)
    .slice(0, 12);

  if (!scenario) return { ok: false, error: "Scenario is required" };
  const actors = stakeholders.length ? stakeholders : ["Customers", "Staff", "Competitors", "Suppliers"];

  const perspectiveTemplates = [
    {
      reaction: "May support the move if the added value is clear, but will compare the change with current alternatives.",
      risk: "Value is not explained strongly enough, so the change is experienced mainly as extra cost or inconvenience.",
      evidence: "Interview or survey a small real sample and compare willingness, objections and switching alternatives."
    },
    {
      reaction: "Will focus on how the decision changes workload, incentives, customer conversations and day-to-day execution.",
      risk: "Operational friction or unclear responsibilities reduce the quality of implementation.",
      evidence: "Run an internal process walk-through and capture the extra work, training and hand-offs required."
    },
    {
      reaction: "Could use the change to reposition, undercut, imitate or communicate a simpler alternative.",
      risk: "Competitors exploit a gap between the promise and the delivered customer experience.",
      evidence: "Review current competitor offers, pricing, messaging and switching friction before launch."
    },
    {
      reaction: "Will assess whether the change affects volume, payment timing, service levels and dependency on the relationship.",
      risk: "A hidden supply or capacity constraint appears only after demand or operating requirements change.",
      evidence: "Confirm capacity, service levels, lead times and commercial terms with critical suppliers."
    }
  ];

  const perspectives = actors.map(function(stakeholder, index) {
    const t = perspectiveTemplates[index % perspectiveTemplates.length];
    return {
      stakeholder,
      reaction: t.reaction + " Scenario under review: " + scenario,
      risk: t.risk,
      evidence: t.evidence
    };
  });

  return {
    ok: true,
    mode: "structured-rehearsal",
    horizon,
    perspectives,
    tensions: [
      "Short-term acceptance may differ from long-term retention.",
      "The same change can create value for one stakeholder and friction for another.",
      "Operational capacity should be tested before marketing creates demand.",
      "Synthetic perspectives must be checked against real customers, real data and real constraints."
    ],
    disclaimer: "Scenario rehearsal only. This is not a guaranteed prediction of real-world behaviour."
  };
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === "/api/health" && req.method === "GET") {
    return json({
      ok: true,
      service: "IZAKHONO BUSINESS AI",
      version: "0.1.0",
      environment: env.APP_ENV || "production",
      aiAdapter: Boolean(env.AI_GATEWAY_URL),
      privacy: {
        behaviouralTracking: false,
        advertisingIds: false,
        rawPromptPersistence: false
      }
    });
  }

  if (url.pathname === "/api/diagnostic" && req.method === "POST") {
    const body = await parseBody(req);
    return json(diagnostic(body));
  }

  if (url.pathname === "/api/scenario" && req.method === "POST") {
    const body = await parseBody(req);
    const result = scenarioReport(body);
    return json(result, result.ok ? 200 : 400);
  }

  if (url.pathname === "/api/ai/correspondence" && req.method === "POST") {
    const body = await parseBody(req);
    const purpose = clean(body.purpose, 120) || "General business email";
    const tone = clean(body.tone, 120) || "Professional and warm";
    const context = clean(body.context, 6000);
    if (!context) return json({ ok: false, error: "Context is required" }, 400);

    const ai = await callAiGateway(env, "business_correspondence", { purpose, tone, context });
    if (ai) return json({ ok: true, mode: "ai", draft: ai });

    return json({
      ok: true,
      mode: "template",
      draft: fallbackDraft(purpose, tone, context)
    });
  }

  return json({ ok: false, error: "Not found" }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(req, env, url);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        return json({ ok: false, error: message }, 500);
      }
    }

    return env.ASSETS.fetch(req);
  }
};
