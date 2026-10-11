/** IZAKHONO MAIL CEO PRIORITY ENGINE */
const RULES = [
  { priority: "critical", score: 100, patterns: [/fraud|hijack|breach|ransomware|security incident|account takeover|legal notice|court order/i] },
  { priority: "urgent", score: 80, patterns: [/urgent|immediate|deadline|payment failed|service down|outage|escalation|complaint/i] },
  { priority: "important", score: 55, patterns: [/partnership|procurement|tender|sponsor|investor|proposal|contract|opportunity|accreditation|media inquiry/i] }
];

export function scoreMessage(message, analysis = {}, routes = []) {
  const text = `${message.subject || ""}\n${message.bodyText || ""}`;
  let score = analysis.risk === "critical" ? 100 : analysis.risk === "high" ? 90 : analysis.risk === "low" ? 5 : 20;
  let priority = analysis.risk === "critical" ? "critical" : analysis.risk === "high" ? "urgent" : analysis.risk === "low" ? "routine" : "routine";
  const reasons = [...(analysis.reasons || [])];
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      if (rule.score > score) { score = rule.score; priority = rule.priority; }
      reasons.push(`${rule.priority} business indicator`);
      break;
    }
  }
  if (routes.some((r) => r.platformId === "fortress") && priority === "routine") {
    score = 60; priority = "important"; reasons.push("FORTRESS security mailbox");
  }
  return { priority, score: Math.min(score, 100), reasons, alert: score >= 80 };
}

export function buildCeoBrief(messages) {
  const sorted = [...messages].sort((a, b) => (b.priority?.score || 0) - (a.priority?.score || 0));
  const counts = { critical: 0, urgent: 0, important: 0, routine: 0 };
  for (const message of sorted) counts[message.priority?.priority || "routine"]++;
  return { generatedAt: new Date().toISOString(), counts, alerts: sorted.filter((m) => (m.priority?.score || 0) >= 80).slice(0, 10), topActions: sorted.filter((m) => (m.priority?.score || 0) >= 55).slice(0, 10), totalProcessed: sorted.length };
}
