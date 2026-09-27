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

function stableNumber(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(function(b) {
    return b.toString(16).padStart(2, "0");
  }).join("");
}

type DecisionSource = {
  name: string;
  type: string;
  text: string;
  hash?: string;
};

type EvidenceTerm = {
  term: string;
  count: number;
};

const STOP_WORDS = new Set([
  "about","after","again","against","also","and","are","because","been","before","being","between",
  "both","business","but","can","could","does","doing","during","each","for","from","further","had",
  "has","have","having","here","how","into","its","more","most","not","our","out","over","same",
  "should","some","such","than","that","the","their","them","then","there","these","they","this",
  "those","through","under","very","was","were","what","when","where","which","while","will","with",
  "would","your","you","scenario","decision"
]);

function extractKeyTerms(sources: DecisionSource[], scenario: string): EvidenceTerm[] {
  const counts = new Map<string, number>();
  const corpus = [scenario].concat(sources.map(function(source) { return source.text; })).join("\n").toLowerCase();
  const words = corpus.match(/[a-z][a-z0-9-]{2,}/g) || [];
  for (const word of words) {
    if (STOP_WORDS.has(word) || /^\d+$/.test(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(function(entry) { return { term: entry[0], count: entry[1] }; })
    .sort(function(a, b) { return b.count - a.count || a.term.localeCompare(b.term); })
    .slice(0, 12);
}

function buildEvidenceGraph(
  scenario: string,
  stakeholders: string[],
  sources: DecisionSource[],
  keyTerms: EvidenceTerm[]
) {
  const nodes: Array<{ id: string; type: string; label: string; meta?: Record<string, unknown> }> = [
    { id: "scenario", type: "scenario", label: scenario.slice(0, 180) }
  ];
  const edges: Array<{ from: string; to: string; relation: string; weight?: number }> = [];

  stakeholders.forEach(function(stakeholder, index) {
    const id = "stakeholder_" + index;
    nodes.push({ id, type: "stakeholder", label: stakeholder });
    edges.push({ from: id, to: "scenario", relation: "reacts_to" });
  });

  sources.forEach(function(source, index) {
    const id = "source_" + index;
    nodes.push({
      id,
      type: "source",
      label: source.name,
      meta: { contentType: source.type, hash: source.hash || null, characters: source.text.length }
    });
    edges.push({ from: id, to: "scenario", relation: "grounds" });
  });

  keyTerms.forEach(function(term, index) {
    const id = "term_" + index;
    nodes.push({ id, type: "term", label: term.term, meta: { mentions: term.count } });
    edges.push({ from: id, to: "scenario", relation: "appears_in_context", weight: term.count });
    sources.forEach(function(source, sourceIndex) {
      const safeTerm = term.term.replace(/[.*+?^()|[\]{}$\\]/g, "\\$&");
      const matches = (source.text.toLowerCase().match(new RegExp("\\b" + safeTerm + "\\b", "g")) || []).length;
      if (matches > 0) edges.push({ from: "source_" + sourceIndex, to: id, relation: "mentions", weight: matches });
    });
  });

  return { nodes, edges, keyTerms };
}

function stanceLabel(score: number): string {
  if (score >= 1.25) return "strongly supportive";
  if (score >= 0.4) return "cautiously supportive";
  if (score > -0.4) return "mixed / undecided";
  if (score > -1.25) return "cautiously resistant";
  return "strongly resistant";
}

function concernFor(stakeholder: string): string {
  const lower = stakeholder.toLowerCase();
  if (lower.includes("customer")) return "value, price, trust and switching effort";
  if (lower.includes("staff") || lower.includes("employee") || lower.includes("team")) return "workload, incentives, training and execution clarity";
  if (lower.includes("competitor")) return "positioning, imitation, undercutting and market response";
  if (lower.includes("supplier")) return "capacity, payment terms, lead times and dependency";
  if (lower.includes("regulat") || lower.includes("compliance")) return "evidence, disclosures, process controls and regulatory obligations";
  if (lower.includes("investor") || lower.includes("bank") || lower.includes("fund")) return "cash generation, downside risk, proof and scalability";
  return "value, risk, effort, timing and alternatives";
}

function reactionSentence(stakeholder: string, score: number, round: number, groupAverage: number, keyTerms: EvidenceTerm[]): string {
  const stance = stanceLabel(score);
  const concern = concernFor(stakeholder);
  const evidenceCue = keyTerms.length ? " Evidence themes include " + keyTerms.slice(0, 3).map(function(t) { return t.term; }).join(", ") + "." : "";
  const influence = Math.abs(groupAverage - score) > 0.7
    ? " The wider group is pulling this agent toward reconsidering part of its initial position."
    : " The wider group does not materially change this agent's current position.";
  return "Round " + round + ": " + stakeholder + " is " + stance + ", focusing on " + concern + "." + influence + evidenceCue;
}

function riskFor(stakeholder: string, stance: number): string {
  const concern = concernFor(stakeholder);
  if (stance < -0.8) return "Resistance around " + concern + " could slow adoption or create active pushback.";
  if (stance > 0.8) return "Support may be overestimated if promised benefits around " + concern + " are not actually delivered.";
  return "Ambivalence around " + concern + " could turn either supportive or resistant as new information appears.";
}

function evidenceToCheckFor(stakeholder: string, keyTerms: EvidenceTerm[]): string {
  const theme = keyTerms.length ? keyTerms[0].term : "the main commercial assumption";
  const lower = stakeholder.toLowerCase();
  if (lower.includes("customer")) return "Interview real customers and test willingness, objections and alternatives, especially around " + theme + ".";
  if (lower.includes("staff") || lower.includes("team")) return "Run an internal process walk-through and quantify extra effort, training and hand-offs.";
  if (lower.includes("competitor")) return "Review current competitor offers, pricing and messaging before launch, then monitor changes after launch.";
  if (lower.includes("supplier")) return "Confirm capacity, lead times, commercial terms and failure contingencies with critical suppliers.";
  return "Collect direct evidence from this stakeholder group and compare it with the simulation assumptions around " + theme + ".";
}

function consensusFromScores(scores: number[]) {
  const average = scores.reduce(function(sum, score) { return sum + score; }, 0) / Math.max(1, scores.length);
  const variance = scores.reduce(function(sum, score) { return sum + Math.pow(score - average, 2); }, 0) / Math.max(1, scores.length);
  const deviation = Math.sqrt(variance);
  const score = Math.round(Math.max(0, Math.min(100, 100 - deviation * 42)));
  const label = score >= 75 ? "high alignment" : score >= 50 ? "mixed alignment" : "strong disagreement";
  const direction = stanceLabel(average);
  return {
    score,
    label,
    averageStance: Number(average.toFixed(2)),
    summary: "The agents show " + label + " overall, with the group ending " + direction + "."
  };
}

async function runDecisionLab(body: JsonObject) {
  const scenario = clean(body.scenario, 4000);
  const horizon = clean(body.horizon, 80) || "90 days";
  const requestedRounds = Math.round(Number(body.rounds || 3));
  const rounds = Math.max(2, Math.min(5, Number.isFinite(requestedRounds) ? requestedRounds : 3));
  const incomingStakeholders = Array.isArray(body.stakeholders) ? body.stakeholders : [];
  const stakeholders = incomingStakeholders
    .map(function(v) { return clean(v, 100); })
    .filter(Boolean)
    .slice(0, 12);
  const actors = stakeholders.length ? stakeholders : ["Customers", "Staff", "Competitors", "Suppliers"];

  if (!scenario) return { ok: false, error: "Scenario is required" };

  const incomingSources = Array.isArray(body.sources) ? body.sources : [];
  const sources: DecisionSource[] = [];
  let totalCharacters = 0;
  for (const item of incomingSources.slice(0, 10)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const source = item as Record<string, unknown>;
    const name = clean(source.name, 120) || "Untitled source";
    const type = clean(source.type, 80) || "text/plain";
    const text = clean(source.text, 120000);
    if (!text) continue;
    if (totalCharacters + text.length > 600000) break;
    totalCharacters += text.length;
    sources.push({ name, type, text, hash: await sha256Hex(text) });
  }

  const keyTerms = extractKeyTerms(sources, scenario);
  const evidenceGraph = buildEvidenceGraph(scenario, actors, sources, keyTerms);

  const personaStyles = [
    "evidence-led pragmatist",
    "risk-sensitive operator",
    "growth-seeking challenger",
    "cost-conscious skeptic",
    "trust-focused relationship builder",
    "execution-focused realist"
  ];

  const agents = actors.map(function(stakeholder, index) {
    const persona = personaStyles[Math.floor(stableNumber(stakeholder + "|persona") * personaStyles.length) % personaStyles.length];
    const evidenceBias = keyTerms.length ? (stableNumber(stakeholder + "|" + keyTerms[0].term) - 0.5) * 0.45 : 0;
    const baseline = (stableNumber(stakeholder + "|" + scenario + "|" + horizon) * 4 - 2) + evidenceBias;
    return {
      stakeholder,
      persona,
      baseline: Math.max(-2, Math.min(2, baseline)),
      rounds: [] as Array<{ round: number; stance: number; reaction: string }>,
      risk: "",
      evidenceToCheck: "",
      finalStance: ""
    };
  });

  let previousAverage = agents.reduce(function(sum, agent) { return sum + agent.baseline; }, 0) / agents.length;
  for (let round = 1; round <= rounds; round++) {
    const currentScores: number[] = [];
    agents.forEach(function(agent, index) {
      const noise = (stableNumber(agent.stakeholder + "|" + scenario + "|round|" + round) - 0.5) * 0.7;
      const convergence = (previousAverage - agent.baseline) * Math.min(0.45, round * 0.10);
      const sourceEffect = sources.length ? (stableNumber((sources[index % sources.length]?.hash || "") + "|" + agent.stakeholder) - 0.5) * 0.35 : 0;
      const score = Math.max(-2, Math.min(2, agent.baseline + convergence + noise + sourceEffect));
      currentScores.push(score);
      agent.rounds.push({
        round,
        stance: Number(score.toFixed(2)),
        reaction: reactionSentence(agent.stakeholder, score, round, previousAverage, keyTerms)
      });
    });
    previousAverage = currentScores.reduce(function(sum, score) { return sum + score; }, 0) / currentScores.length;
  }

  agents.forEach(function(agent) {
    const finalScore = agent.rounds[agent.rounds.length - 1].stance;
    agent.finalStance = stanceLabel(finalScore);
    agent.risk = riskFor(agent.stakeholder, finalScore);
    agent.evidenceToCheck = evidenceToCheckFor(agent.stakeholder, keyTerms);
  });

  const finalScores = agents.map(function(agent) { return agent.rounds[agent.rounds.length - 1].stance; });
  const consensus = consensusFromScores(finalScores);
  const ranked = agents.slice().sort(function(a, b) {
    return a.rounds[a.rounds.length - 1].stance - b.rounds[b.rounds.length - 1].stance;
  });
  const disagreements: string[] = [];
  if (ranked.length > 1) {
    const low = ranked[0];
    const high = ranked[ranked.length - 1];
    disagreements.push(
      high.stakeholder + " ends " + high.finalStance + " while " + low.stakeholder + " ends " + low.finalStance + "."
    );
  }
  if (sources.length === 0) {
    disagreements.push("No evidence packet was supplied, so this run relies more heavily on structural assumptions.");
  } else {
    disagreements.push("Evidence packet contains " + sources.length + " source(s) and " + totalCharacters + " characters; simulated reactions still require real-world validation.");
  }

  const nextTests = [
    agents[0]?.evidenceToCheck || "Interview a small real stakeholder sample.",
    "Define one measurable success threshold and one stop-loss threshold before acting.",
    "Run the same scenario with one important assumption reversed and compare the result.",
    "Record what actually happens so future simulations can be calibrated against real outcomes."
  ];

  const manifestInput = JSON.stringify({
    version: "0.2",
    scenario,
    horizon,
    rounds,
    stakeholders: actors,
    sources: sources.map(function(source) { return { name: source.name, type: source.type, hash: source.hash }; })
  });
  const inputHash = await sha256Hex(manifestInput);
  const runId = "idl_" + inputHash.slice(0, 12);

  return {
    ok: true,
    engine: "IZAKHONO Decision Lab",
    version: "0.2",
    mode: "local-structured-multi-agent",
    runId,
    inputHash,
    horizon,
    rounds,
    sourceCount: sources.length,
    sourceHashes: sources.map(function(source) { return { name: source.name, hash: source.hash }; }),
    evidenceGraph,
    agents,
    consensus,
    disagreements,
    nextTests,
    disclaimer: "Synthetic scenario rehearsal only. This output is not a guaranteed prediction, real stakeholder research or real-world evidence."
  };
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === "/api/health" && req.method === "GET") {
    return json({
      ok: true,
      service: "IZAKHONO BUSINESS AI",
      version: "0.2.0",
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

  if ((url.pathname === "/api/decision-lab/run" || url.pathname === "/api/scenario") && req.method === "POST") {
    const body = await parseBody(req);
    const result = await runDecisionLab(body);
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
