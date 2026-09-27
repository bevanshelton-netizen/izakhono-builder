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

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = values.slice().sort(function(a, b) { return a - b; });
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

function standardDeviation(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce(function(sum, value) { return sum + value; }, 0) / values.length;
  const variance = values.reduce(function(sum, value) { return sum + Math.pow(value - mean, 2); }, 0) / values.length;
  return Math.sqrt(variance);
}

function directionFromMean(mean: number): string {
  if (mean >= 0.55) return "leans supportive";
  if (mean <= -0.55) return "leans resistant";
  return "mixed / uncertain";
}

function buildRedTeamFindings(scenario: string, keyTerms: EvidenceTerm[]) {
  const lower = scenario.toLowerCase();
  const theme = keyTerms.length ? keyTerms[0].term : "the core assumption";
  const findings = [
    {
      domain: "Operational failure",
      finding: "The decision may create demand, workload or service obligations faster than delivery capacity can absorb.",
      test: "Run a capacity and hand-off rehearsal with real owners, lead times and fallback steps."
    },
    {
      domain: "Fraud / abuse",
      finding: "New offers, payments, account changes or urgency can create impersonation, refund and social-engineering opportunities.",
      test: "Map abuse paths, approval controls, payment verification and customer-authentication steps before launch."
    },
    {
      domain: "Evidence quality",
      finding: "The simulation can amplify assumptions if the evidence packet is thin or one-sided around " + theme + ".",
      test: "Add contradictory evidence and at least one independent real-world source, then rerun."
    }
  ];
  if (lower.includes("price") || lower.includes("fee") || lower.includes("cost")) {
    findings.push({
      domain: "Commercial downside",
      finding: "A pricing move can improve unit economics while increasing churn, objections or switching behaviour.",
      test: "Pilot with a defined cohort and measure conversion, churn, complaints and gross margin together."
    });
  }
  if (lower.includes("bank") || lower.includes("insurance") || lower.includes("finance") || lower.includes("credit") || lower.includes("customer data")) {
    findings.push({
      domain: "Legal / compliance",
      finding: "Regulated-sector obligations, disclosures, privacy controls and approval records may change the feasible implementation.",
      test: "Obtain jurisdiction-specific compliance review before external launch and preserve an audit trail."
    });
  }
  return findings;
}

function createReportAgentSummary(
  scenario: string,
  groupStats: Array<{ group: string; mean: number; direction: string; supportivePct: number; resistantPct: number }>,
  uncertainty: { label: string; mean: number; min: number; max: number },
  redTeamFindings: Array<{ domain: string; finding: string; test: string }>
) {
  const sorted = groupStats.slice().sort(function(a, b) { return a.mean - b.mean; });
  const mostResistant = sorted[0];
  const mostSupportive = sorted[sorted.length - 1];
  const tensions: string[] = [];
  if (mostSupportive && mostResistant && mostSupportive.group !== mostResistant.group) {
    tensions.push(
      mostSupportive.group + " is comparatively more supportive while " + mostResistant.group + " is comparatively more resistant."
    );
  }
  if (uncertainty.label !== "low") {
    tensions.push("Repeated runs show " + uncertainty.label + " uncertainty, so a single synthetic outcome should not drive the decision.");
  }
  if (redTeamFindings.length) {
    tensions.push("Red-team review found " + redTeamFindings.length + " areas that need explicit real-world checks.");
  }

  return {
    summary:
      "For the scenario \"" + scenario.slice(0, 180) + (scenario.length > 180 ? "…" : "") +
      "\", the repeated simulations " + directionFromMean(uncertainty.mean) +
      ". The observed synthetic range is " + uncertainty.min.toFixed(2) + " to " + uncertainty.max.toFixed(2) +
      ", with " + uncertainty.label + " uncertainty. Treat this as structured rehearsal, not a prediction.",
    keyTensions: tensions
  };
}

function simulateScenario(
  scenario: string,
  horizon: string,
  actors: string[],
  sources: DecisionSource[],
  keyTerms: EvidenceTerm[],
  rounds: number,
  population: number,
  trials: number,
  redTeam: boolean
) {
  const personaStyles = [
    "evidence-led pragmatist",
    "risk-sensitive operator",
    "growth-seeking challenger",
    "cost-conscious skeptic",
    "trust-focused relationship builder",
    "execution-focused realist",
    "service-quality advocate",
    "cash-flow realist"
  ];

  const groupScores = new Map<string, number[]>();
  actors.forEach(function(actor) { groupScores.set(actor, []); });
  const trialMeans: number[] = [];
  const allFinalScores: number[] = [];
  const sampleAgents: Array<{
    label: string;
    stakeholder: string;
    persona: string;
    trial: number;
    finalScore: number;
    finalStance: string;
    reactions: string[];
  }> = [];

  for (let trial = 1; trial <= trials; trial++) {
    const agents = Array.from({ length: population }).map(function(_unused, index) {
      const group = actors[index % actors.length];
      const label = group + " #" + (Math.floor(index / actors.length) + 1);
      const personaIndex = Math.floor(stableNumber(label + "|persona|" + trial) * personaStyles.length) % personaStyles.length;
      const evidenceBias = keyTerms.length
        ? (stableNumber(label + "|" + keyTerms[index % keyTerms.length].term) - 0.5) * 0.45
        : 0;
      const baseline = Math.max(
        -2,
        Math.min(2, (stableNumber(label + "|" + scenario + "|" + horizon + "|trial|" + trial) * 4 - 2) + evidenceBias)
      );
      return {
        group,
        label,
        persona: personaStyles[personaIndex],
        score: baseline,
        reactions: [] as string[]
      };
    });

    for (let round = 1; round <= rounds; round++) {
      const previousAverage = agents.reduce(function(sum, agent) { return sum + agent.score; }, 0) / agents.length;
      agents.forEach(function(agent, index) {
        const noise = (stableNumber(agent.label + "|" + scenario + "|trial|" + trial + "|round|" + round) - 0.5) * 0.85;
        const convergence = (previousAverage - agent.score) * Math.min(0.42, 0.08 + round * 0.07);
        const sourceEffect = sources.length
          ? (stableNumber((sources[index % sources.length].hash || "") + "|" + agent.label + "|" + trial) - 0.5) * 0.4
          : 0;
        agent.score = Math.max(-2, Math.min(2, agent.score + convergence + noise + sourceEffect));
        if (sampleAgents.length < 8 && trial === 1) {
          agent.reactions.push(reactionSentence(agent.group, agent.score, round, previousAverage, keyTerms));
        }
      });
    }

    const finals = agents.map(function(agent) { return agent.score; });
    const mean = finals.reduce(function(sum, score) { return sum + score; }, 0) / finals.length;
    trialMeans.push(mean);
    finals.forEach(function(score) { allFinalScores.push(score); });

    agents.forEach(function(agent) {
      const list = groupScores.get(agent.group);
      if (list) list.push(agent.score);
    });

    if (trial === 1) {
      agents.slice(0, 8).forEach(function(agent) {
        sampleAgents.push({
          label: agent.label,
          stakeholder: agent.group,
          persona: agent.persona,
          trial,
          finalScore: Number(agent.score.toFixed(2)),
          finalStance: stanceLabel(agent.score),
          reactions: agent.reactions.slice()
        });
      });
    }
  }

  const groupStats = actors.map(function(group) {
    const scores = groupScores.get(group) || [];
    const mean = scores.reduce(function(sum, score) { return sum + score; }, 0) / Math.max(1, scores.length);
    const supportive = scores.filter(function(score) { return score >= 0.4; }).length;
    const resistant = scores.filter(function(score) { return score <= -0.4; }).length;
    return {
      group,
      mean: Number(mean.toFixed(2)),
      p10: Number(percentile(scores, 0.10).toFixed(2)),
      p90: Number(percentile(scores, 0.90).toFixed(2)),
      supportivePct: Math.round((supportive / Math.max(1, scores.length)) * 100),
      resistantPct: Math.round((resistant / Math.max(1, scores.length)) * 100),
      direction: directionFromMean(mean),
      evidenceToCheck: evidenceToCheckFor(group, keyTerms)
    };
  });

  const overallMean = trialMeans.reduce(function(sum, score) { return sum + score; }, 0) / Math.max(1, trialMeans.length);
  const deviation = standardDeviation(trialMeans);
  const uncertainty = {
    mean: Number(overallMean.toFixed(2)),
    min: Number(Math.min.apply(null, trialMeans).toFixed(2)),
    max: Number(Math.max.apply(null, trialMeans).toFixed(2)),
    stdDev: Number(deviation.toFixed(2)),
    label: deviation < 0.15 ? "low" : deviation < 0.35 ? "moderate" : "high",
    direction: directionFromMean(overallMean)
  };

  const consensus = consensusFromScores(allFinalScores);
  const redTeamFindings = redTeam ? buildRedTeamFindings(scenario, keyTerms) : [];
  const reportAgent = createReportAgentSummary(scenario, groupStats, uncertainty, redTeamFindings);

  return {
    scenario,
    population,
    trials,
    rounds,
    uncertainty,
    consensus,
    groupStats,
    sampleAgents,
    redTeamFindings,
    reportAgent
  };
}

function compareScenarios(
  a: ReturnType<typeof simulateScenario>,
  b: ReturnType<typeof simulateScenario>
) {
  const delta = Number((a.uncertainty.mean - b.uncertainty.mean).toFixed(2));
  const differences: string[] = [];
  const groups = new Set(a.groupStats.map(function(item) { return item.group; }).concat(b.groupStats.map(function(item) { return item.group; })));
  groups.forEach(function(group) {
    const ga = a.groupStats.find(function(item) { return item.group === group; });
    const gb = b.groupStats.find(function(item) { return item.group === group; });
    if (!ga || !gb) return;
    const d = Number((ga.mean - gb.mean).toFixed(2));
    if (Math.abs(d) >= 0.2) {
      differences.push(group + " differs by " + d.toFixed(2) + " stance points between A and B.");
    }
  });
  return {
    meanDeltaAminusB: delta,
    summary:
      "Scenario A and Scenario B are compared on the same synthetic population and evidence packet. " +
      "The overall mean stance difference (A minus B) is " + delta.toFixed(2) +
      ". This describes the simulation output; it is not a recommendation or forecast.",
    differences: differences.slice(0, 8)
  };
}

async function runDecisionLab(body: JsonObject) {
  const scenario = clean(body.scenario, 4000);
  const scenarioB = clean(body.scenarioB, 4000);
  const horizon = clean(body.horizon, 80) || "90 days";
  const requestedRounds = Math.round(Number(body.rounds || 3));
  const rounds = Math.max(2, Math.min(5, Number.isFinite(requestedRounds) ? requestedRounds : 3));
  const requestedPopulation = Math.round(Number(body.population || 25));
  const population = Math.max(8, Math.min(100, Number.isFinite(requestedPopulation) ? requestedPopulation : 25));
  const requestedTrials = Math.round(Number(body.trials || 3));
  const trials = Math.max(3, Math.min(10, Number.isFinite(requestedTrials) ? requestedTrials : 3));
  const redTeam = body.redTeam !== false;

  const incomingStakeholders = Array.isArray(body.stakeholders) ? body.stakeholders : [];
  const stakeholders = incomingStakeholders
    .map(function(v) { return clean(v, 100); })
    .filter(Boolean)
    .slice(0, 12);
  const actors = stakeholders.length ? stakeholders : ["Customers", "Staff", "Competitors", "Suppliers"];

  if (!scenario) return { ok: false, error: "Scenario A is required" };

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

  const combinedScenario = scenarioB ? scenario + "\nALTERNATIVE:\n" + scenarioB : scenario;
  const keyTerms = extractKeyTerms(sources, combinedScenario);
  const evidenceGraph = buildEvidenceGraph(combinedScenario, actors, sources, keyTerms);

  const resultA = simulateScenario(scenario, horizon, actors, sources, keyTerms, rounds, population, trials, redTeam);
  const resultB = scenarioB
    ? simulateScenario(scenarioB, horizon, actors, sources, keyTerms, rounds, population, trials, redTeam)
    : null;

  const nextTests = [
    resultA.groupStats.slice().sort(function(a, b) { return a.mean - b.mean; })[0]?.evidenceToCheck || "Interview a real stakeholder sample.",
    "Define one measurable success threshold and one stop-loss threshold before acting.",
    scenarioB ? "Pilot A and B with comparable real-world cohorts before scaling." : "Run an alternative scenario with one important assumption reversed.",
    "Record what actually happens and attach the observation to this run for calibration."
  ];

  const manifestInput = JSON.stringify({
    version: "0.3",
    scenario,
    scenarioB,
    horizon,
    rounds,
    population,
    trials,
    redTeam,
    stakeholders: actors,
    sources: sources.map(function(source) { return { name: source.name, type: source.type, hash: source.hash }; })
  });
  const inputHash = await sha256Hex(manifestInput);
  const runId = "idl_" + inputHash.slice(0, 12);

  return {
    ok: true,
    engine: "IZAKHONO Decision Lab",
    version: "0.3",
    mode: "owned-structured-multi-agent",
    runId,
    inputHash,
    horizon,
    rounds,
    population,
    trials,
    sourceCount: sources.length,
    sourceCharacters: totalCharacters,
    sourceHashes: sources.map(function(source) { return { name: source.name, hash: source.hash, type: source.type }; }),
    evidenceGraph,
    scenarios: {
      A: resultA,
      B: resultB
    },
    comparison: resultB ? compareScenarios(resultA, resultB) : null,
    nextTests,
    disclaimer: "Synthetic scenario rehearsal only. This output is not a guaranteed prediction, real stakeholder research, legal advice or real-world evidence."
  };
}

function answerDecisionLabQuestion(body: JsonObject) {
  const question = clean(body.question, 1000);
  const report = body.report;
  if (!question) return { ok: false, error: "Question is required" };
  if (!report || typeof report !== "object" || Array.isArray(report)) return { ok: false, error: "A Decision Lab report is required" };

  const r = report as Record<string, any>;
  const scenarios = r.scenarios || {};
  const a = scenarios.A;
  if (!a || !Array.isArray(a.groupStats)) return { ok: false, error: "Unsupported report format" };

  const q = question.toLowerCase();
  const matchedGroup = a.groupStats.find(function(group: any) {
    return q.includes(String(group.group || "").toLowerCase());
  });

  if (matchedGroup) {
    return {
      ok: true,
      answer:
        matchedGroup.group + " " + matchedGroup.direction + " in Scenario A, with mean stance " +
        Number(matchedGroup.mean).toFixed(2) + " and a 10–90% range of " +
        Number(matchedGroup.p10).toFixed(2) + " to " + Number(matchedGroup.p90).toFixed(2) +
        ". The report says to check: " + matchedGroup.evidenceToCheck
    };
  }

  if (q.includes("resist") || q.includes("objection") || q.includes("pushback")) {
    const sorted = a.groupStats.slice().sort(function(x: any, y: any) { return x.mean - y.mean; });
    const group = sorted[0];
    return {
      ok: true,
      answer:
        "In Scenario A, " + group.group + " has the lowest mean stance (" + Number(group.mean).toFixed(2) +
        "). That is a synthetic signal, not observed behaviour. Validate it with: " + group.evidenceToCheck
    };
  }

  if (q.includes("risk") || q.includes("red team") || q.includes("fail")) {
    const findings = Array.isArray(a.redTeamFindings) ? a.redTeamFindings : [];
    return {
      ok: true,
      answer: findings.length
        ? findings.slice(0, 4).map(function(item: any) { return item.domain + ": " + item.finding + " Check: " + item.test; }).join("\n\n")
        : "Red-Team agents were disabled for this run."
    };
  }

  if (q.includes("uncertain") || q.includes("confidence") || q.includes("range")) {
    return {
      ok: true,
      answer:
        "Scenario A shows " + a.uncertainty.label + " cross-run uncertainty. The repeated-run mean is " +
        Number(a.uncertainty.mean).toFixed(2) + ", ranging from " + Number(a.uncertainty.min).toFixed(2) +
        " to " + Number(a.uncertainty.max).toFixed(2) + ". These are synthetic variation measures, not statistical confidence intervals about the real world."
    };
  }

  if ((q.includes("compare") || q.includes("difference") || q.includes("scenario b")) && r.comparison) {
    return {
      ok: true,
      answer: r.comparison.summary + (Array.isArray(r.comparison.differences) && r.comparison.differences.length
        ? "\n\n" + r.comparison.differences.join("\n")
        : "")
    };
  }

  const summary = a.reportAgent && a.reportAgent.summary ? a.reportAgent.summary : "The report is available but has no Report Agent summary.";
  const tests = Array.isArray(r.nextTests) ? r.nextTests.slice(0, 3).join(" ") : "";
  return {
    ok: true,
    answer: summary + (tests ? "\n\nNext evidence checks: " + tests : "")
  };
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === "/api/health" && req.method === "GET") {
    return json({
      ok: true,
      service: "IZAKHONO BUSINESS AI",
      version: "0.3.0",
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

  if (url.pathname === "/api/decision-lab/ask" && req.method === "POST") {
    const body = await parseBody(req);
    const result = answerDecisionLabQuestion(body);
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
