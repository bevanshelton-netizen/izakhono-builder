/**
 * Topic PDF on-demand generation contract.
 *
 * This module is provider-neutral and deterministic. It validates a reader's
 * brief, plans the editorial workflow, applies conservative review gates and
 * validates the resulting manuscript before PDF rendering. It does not call
 * an LLM, browse the web, or claim a document has been fact-checked.
 */

export type GenerationStatus =
  | 'requested'
  | 'scoping'
  | 'research_required'
  | 'drafting'
  | 'quality_review'
  | 'specialist_review'
  | 'ready_for_editor'
  | 'approved'
  | 'rendering'
  | 'delivered'
  | 'blocked'
  | 'failed';

export type ReviewGate =
  | 'source_verification'
  | 'copyright_and_rights'
  | 'factual_review'
  | 'specialist_review'
  | 'human_editorial_approval';

export interface TopicPdfRequest {
  topic: string;
  readerOutcome: string;
  audience: string;
  language: string;
  countryOrJurisdiction?: string;
  depth?: 'quick' | 'practical' | 'comprehensive';
  includeWorksheets?: boolean;
  includeExamples?: boolean;
  requestedAt?: string;
}

export interface TopicPdfPlan {
  schema: 'izakhono.topic-pdf-generation/v1';
  request: TopicPdfRequest;
  normalizedTopic: string;
  status: GenerationStatus;
  scope: {
    audience: string;
    geography: string;
    language: string;
    depth: 'quick' | 'practical' | 'comprehensive';
    readerOutcome: string;
  };
  risk: {
    level: 'standard' | 'elevated' | 'high';
    domains: string[];
    requiresSpecialistReview: boolean;
    reasons: string[];
  };
  stages: Array<{
    id: string;
    title: string;
    purpose: string;
    required: boolean;
    humanApproval: boolean;
  }>;
  gates: ReviewGate[];
  publication: {
    targetPriceUsd: 7;
    saleEligible: false;
    publicDistribution: false;
  };
}

const HIGH_STAKES: Record<string, string[]> = {
  medical: ['medical', 'diagnosis', 'treatment', 'medicine', 'medication', 'symptom', 'disease', 'clinical', 'mental health'],
  legal: ['legal', 'law', 'lawsuit', 'contract', 'immigration', 'visa', 'divorce', 'criminal', 'litigation'],
  financial: ['investment', 'investing', 'tax', 'taxation', 'debt counselling', 'retirement', 'securities', 'insurance', 'financial advice'],
  safety: ['electrical wiring', 'structural engineering', 'firearm', 'explosive', 'hazardous chemical', 'emergency procedure'],
};

const RESTRICTED_OR_HARMFUL = [
  'build a bomb', 'make an explosive', 'evade law enforcement',
  'steal credentials', 'deploy ransomware', 'make a poison',
  'instructions for self-harm', 'how to harm someone',
];

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

export function validateTopicPdfRequest(input: unknown): { ok: true; request: TopicPdfRequest } | { ok: false; errors: string[] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['Request must be a JSON object.'] };
  }
  const value = input as Record<string, unknown>;
  const request: TopicPdfRequest = {
    topic: text(value.topic, 240),
    readerOutcome: text(value.readerOutcome, 500),
    audience: text(value.audience, 240),
    language: text(value.language, 80),
    countryOrJurisdiction: text(value.countryOrJurisdiction, 120) || undefined,
    depth: ['quick', 'practical', 'comprehensive'].includes(String(value.depth))
      ? value.depth as TopicPdfRequest['depth'] : 'practical',
    includeWorksheets: value.includeWorksheets !== false,
    includeExamples: value.includeExamples !== false,
  };
  const errors: string[] = [];
  if (request.topic.length < 3) errors.push('Topic must contain at least 3 characters.');
  if (request.readerOutcome.length < 10) errors.push('Describe what the reader should be able to understand or do.');
  if (!request.audience) errors.push('Specify the intended reader or audience.');
  if (!request.language) errors.push('Specify the publication language.');
  if (errors.length) return { ok: false, errors };
  return { ok: true, request };
}

export function assessTopicRisk(topic: string, outcome = ''): TopicPdfPlan['risk'] {
  const combined = (topic + ' ' + outcome).toLowerCase();
  const domains = Object.entries(HIGH_STAKES)
    .filter(([, terms]) => terms.some(term => combined.includes(term)))
    .map(([domain]) => domain);
  const reasons = domains.map(domain => `Topic may involve ${domain} guidance; verify claims and applicable local requirements.`);
  const level = domains.length >= 2 ? 'high' : domains.length === 1 ? 'elevated' : 'standard';
  return {
    level,
    domains,
    requiresSpecialistReview: domains.length > 0,
    reasons,
  };
}

export function isRestrictedTopic(topic: string, outcome = ''): boolean {
  const combined = (topic + ' ' + outcome).toLowerCase();
  return RESTRICTED_OR_HARMFUL.some(term => combined.includes(term));
}

/**
 * The catalogue is a discovery aid, never an allow-list. Any valid, non-
 * restricted topic may be scoped; unsupported or risky claims are routed
 * through the appropriate review gates rather than silently published.
 */
export function planTopicPdfGeneration(input: TopicPdfRequest): TopicPdfPlan {
  const normalizedTopic = text(input.topic, 240);
  const risk = assessTopicRisk(normalizedTopic, input.readerOutcome);
  const restricted = isRestrictedTopic(normalizedTopic, input.readerOutcome);
  const gates: ReviewGate[] = [
    'source_verification',
    'copyright_and_rights',
    'factual_review',
    ...(risk.requiresSpecialistReview ? ['specialist_review' as const] : []),
    'human_editorial_approval',
  ];
  const stages = [
    { id: 'scope', title: 'Define the guide', purpose: 'Confirm the reader, outcome, language, geography, scope and exclusions.', required: true, humanApproval: false },
    { id: 'research', title: 'Research and source ledger', purpose: 'Find authoritative, current sources; record publication dates, access dates, claims supported and usage rights.', required: true, humanApproval: false },
    { id: 'outline', title: 'Build the editorial outline', purpose: 'Create a coherent guide structure, learning progression and practical examples.', required: true, humanApproval: false },
    { id: 'draft', title: 'Write the original guide', purpose: 'Produce original explanatory prose, examples, checklists and worksheets appropriate to the brief.', required: true, humanApproval: false },
    { id: 'verify', title: 'Verify claims and rights', purpose: 'Check factual claims against sources and ensure text, images, tables and quotations are rights-cleared.', required: true, humanApproval: true },
    { id: 'review', title: 'Specialist and editorial review', purpose: 'Route elevated/high-stakes content to qualified reviewers and obtain editorial approval.', required: true, humanApproval: true },
    { id: 'render', title: 'Render and inspect PDF', purpose: 'Create accessible PDF, inspect pagination, links, fonts, tables, metadata and document integrity.', required: true, humanApproval: false },
    { id: 'release', title: 'Approve publication and delivery', purpose: 'Only an approved, versioned publication can enter the catalogue or be delivered as a paid product.', required: true, humanApproval: true },
  ];
  return {
    schema: 'izakhono.topic-pdf-generation/v1',
    request: input,
    normalizedTopic,
    status: restricted ? 'blocked' : 'requested',
    scope: {
      audience: input.audience,
      geography: input.countryOrJurisdiction || 'International / jurisdiction-neutral; local rules must be identified where relevant',
      language: input.language,
      depth: input.depth || 'practical',
      readerOutcome: input.readerOutcome,
    },
    risk: {
      ...risk,
      level: restricted ? 'high' : risk.level,
      reasons: restricted ? [...risk.reasons, 'The requested instructions appear to facilitate harm or wrongdoing and cannot be generated as requested.'] : risk.reasons,
    },
    stages,
    gates,
    publication: {
      targetPriceUsd: 7,
      saleEligible: false,
      publicDistribution: false,
    },
  };
}

export interface ResearchSource {
  title: string;
  publisher: string;
  url: string;
  publishedAt?: string;
  accessedAt: string;
  supports: string[];
  rightsNote: string;
}

export interface TopicPdfManuscript {
  title: string;
  author: string;
  language: string;
  geography: string;
  version: string;
  sections: Array<{ heading: string; body: string }>;
  sources: ResearchSource[];
  rightsReviewed: boolean;
  factualReviewPassed: boolean;
  specialistReviewPassed: boolean;
  editorialApproval: boolean;
}

export function evaluateManuscript(manuscript: TopicPdfManuscript, plan: TopicPdfPlan) {
  const issues: string[] = [];
  if (!text(manuscript.title, 180)) issues.push('A publication title is required.');
  if (!text(manuscript.author, 120)) issues.push('An author or accountable publisher is required.');
  if (!manuscript.sections?.length || manuscript.sections.some(s => !text(s.heading, 180) || !text(s.body, 80))) {
    issues.push('Every guide needs substantive sections with headings and explanatory content.');
  }
  if (!manuscript.sources?.length) issues.push('A source ledger is required.');
  if (manuscript.sources?.some(s => !s.title || !s.publisher || !s.url || !s.accessedAt || !s.supports?.length || !s.rightsNote)) {
    issues.push('Every source must include publisher, URL, access date, supported claims and a rights note.');
  }
  if (!manuscript.rightsReviewed) issues.push('Copyright and third-party rights review is incomplete.');
  if (!manuscript.factualReviewPassed) issues.push('Factual review has not passed.');
  if (plan.risk.requiresSpecialistReview && !manuscript.specialistReviewPassed) issues.push('Qualified specialist review is required and has not passed.');
  if (!manuscript.editorialApproval) issues.push('Human editorial approval is required.');
  return {
    passed: issues.length === 0,
    issues,
    saleEligible: issues.length === 0,
  };
}
