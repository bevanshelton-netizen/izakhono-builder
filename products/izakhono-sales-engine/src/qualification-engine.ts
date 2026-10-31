export type LeadStage = "new" | "researching" | "qualified" | "outreach_ready" | "contacted" | "engaged" | "proposal" | "won" | "lost";

export interface SalesLead {
  company: string;
  contact?: string | null;
  role?: string | null;
  email?: string | null;
  need?: string | null;
  score?: number | null;
  stage?: LeadStage | null;
  source?: string | null;
}

export interface QualificationResult {
  score: number;
  stage: LeadStage;
  reasons: string[];
}

/**
 * Deterministic qualification layer used before AI enrichment/outreach.
 * It deliberately does not invent facts: missing information reduces confidence.
 */
export function qualifyLead(lead: SalesLead): QualificationResult {
  let score = 0;
  const reasons: string[] = [];

  const company = (lead.company ?? "").trim();
  const contact = (lead.contact ?? "").trim();
  const role = (lead.role ?? "").trim().toLowerCase();
  const email = (lead.email ?? "").trim();
  const need = (lead.need ?? "").trim().toLowerCase();

  if (company) { score += 15; reasons.push("Company identified"); }
  if (contact) { score += 10; reasons.push("Named contact identified"); }
  if (email) { score += 15; reasons.push("Email contact available"); }
  if (need) { score += 20; reasons.push("Commercial need identified"); }

  const decisionMakerTerms = [
    "ceo", "chief", "director", "head", "procurement", "purchasing",
    "partnership", "operations", "supply chain", "owner", "founder", "manager"
  ];
  if (decisionMakerTerms.some((term) => role.includes(term))) {
    score += 20;
    reasons.push("Likely decision-maker or buying influence");
  }

  const highIntentTerms = [
    "procurement", "uniform", "apparel", "ppe", "training", "recruitment",
    "fleet", "security", "mobility", "branded", "supply", "partnership"
  ];
  if (highIntentTerms.some((term) => need.includes(term))) {
    score += 20;
    reasons.push("Need aligns with an IZAKHONO commercial offering");
  }

  score = Math.min(100, score);

  let stage: LeadStage;
  if (score >= 85 && email && need) stage = "outreach_ready";
  else if (score >= 70) stage = "qualified";
  else if (score >= 45) stage = "researching";
  else stage = "new";

  return { score, stage, reasons };
}

export function qualifyLeads(leads: SalesLead[]): QualificationResult[] {
  return leads.map(qualifyLead);
}
