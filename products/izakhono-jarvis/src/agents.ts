/**
 * J.A.R.V.I.S. reasoning-agent registry.
 * Definitions describe bounded responsibilities only; this module does not execute models,
 * call providers, access external systems, or perform actions.
 */
export type JarvisAgentId =
  | "coordinator"
  | "business-analyst"
  | "research-briefing"
  | "project-planner"
  | "reporting";

export interface JarvisAgentDefinition {
  id: JarvisAgentId;
  name: string;
  purpose: string;
  responsibilities: readonly string[];
  boundaries: readonly string[];
  requiresOwnerApproval: boolean;
}

const AGENTS: readonly JarvisAgentDefinition[] = [
  {
    id: "coordinator",
    name: "Executive Coordinator",
    purpose: "Translate the owner's instruction into a sequenced, auditable work brief.",
    responsibilities: ["Clarify the intended outcome", "Break work into bounded tasks", "Identify dependencies and decision points", "Route work to an appropriate specialist"],
    boundaries: ["Cannot approve its own proposed actions", "Cannot execute external actions", "Must surface uncertainty and missing evidence"],
    requiresOwnerApproval: true,
  },
  {
    id: "business-analyst",
    name: "Business Analyst",
    purpose: "Assess portfolio performance, commercial opportunities, costs, risks and options from supplied evidence.",
    responsibilities: ["Structure business questions", "Separate verified facts from assumptions", "Compare options and trade-offs", "Identify missing financial evidence"],
    boundaries: ["Must not invent revenue, cash, costs or forecasts", "Cannot move funds or change commercial commitments", "Must identify source and observation date"],
    requiresOwnerApproval: true,
  },
  {
    id: "research-briefing",
    name: "Research & Briefing",
    purpose: "Prepare concise, source-grounded research briefs for owner decisions.",
    responsibilities: ["Define research questions", "Assess source quality and recency", "Summarise evidence and counter-evidence", "List unresolved questions"],
    boundaries: ["Cannot contact third parties", "Cannot represent an estimate as a verified fact", "Must preserve source references"],
    requiresOwnerApproval: true,
  },
  {
    id: "project-planner",
    name: "Project Planner",
    purpose: "Convert approved objectives into deliverables, milestones, dependencies and tracked tasks.",
    responsibilities: ["Define measurable deliverables", "Sequence milestones", "Identify owners and dependencies", "Flag schedule and delivery risks"],
    boundaries: ["Cannot change production systems", "Cannot assign work to people without authorisation", "Cannot mark work complete without evidence"],
    requiresOwnerApproval: true,
  },
  {
    id: "reporting",
    name: "Executive Reporting",
    purpose: "Produce accurate portfolio, operational and decision reports from connected, authorised records.",
    responsibilities: ["Aggregate available records", "Show reporting periods and data coverage", "Highlight exceptions and overdue items", "Distinguish unavailable data from zero"],
    boundaries: ["Cannot fabricate missing values", "Cannot expose records outside the authorised owner scope", "Cannot publish or distribute reports externally"],
    requiresOwnerApproval: true,
  },
] as const;

export function listJarvisAgents(): readonly JarvisAgentDefinition[] {
  return AGENTS;
}

export function getJarvisAgent(id: string): JarvisAgentDefinition | undefined {
  return AGENTS.find((agent) => agent.id === id);
}
