export type CommandKind = 'action' | 'launcher' | 'workflow';

export type CommandDefinition = {
  name: string;
  label: string;
  category: string;
  description: string;
  kind: CommandKind;
  requiresArg?: boolean;
  aliases?: string[];
  path?: string;
  steps?: string[];
};

const title = (name: string) => name
  .split('-')
  .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
  .join(' ');

const ACTIONS: CommandDefinition[] = [
  { name: 'health', label: 'System Health', category: 'Owner Control', description: 'Check the live IZAKHONO Builder database and command engine.', kind: 'action' },
  { name: 'portfolio', label: 'Portfolio', category: 'Owner Control', description: 'Load the owner project portfolio and current build states.', kind: 'action' },
  { name: 'project', label: 'Project Status', category: 'Owner Control', description: 'Inspect one project by slug.', kind: 'action', requiresArg: true, aliases: ['status'] },
  { name: 'plan', label: 'Build Plan', category: 'Build & Deploy', description: 'Generate or refresh the existing project build recipe.', kind: 'action', requiresArg: true },
  { name: 'generate', label: 'Generate Package', category: 'Build & Deploy', description: 'Generate the repository-ready runnable source bundle for an existing project.', kind: 'action', requiresArg: true },
  { name: 'validate', label: 'Validate & Commit', category: 'Build & Deploy', description: 'Run deterministic validation and commit validated source into the IZAKHONO internal repository.', kind: 'action', requiresArg: true },
  { name: 'repo', label: 'Internal Repository', category: 'Build & Deploy', description: 'Inspect IZAKHONO internal repository history for a project.', kind: 'action', requiresArg: true, aliases: ['repository'] },
  { name: 'payments', label: 'Add Payments', category: 'Revenue', description: 'Add the Payments module to an existing project and regenerate its build plan.', kind: 'action', requiresArg: true },
  { name: 'launch', label: 'Technical Launch Gate', category: 'Build & Deploy', description: 'Run plan → generate → validate → internal commit. Produces a technical preview, not a public-production claim.', kind: 'action', requiresArg: true, aliases: ['buildproof'] },
  { name: 'infra', label: 'Owned Infrastructure Health', category: 'Owner Control', description: 'Inspect IZAKHONO owned infrastructure health from NODE01.', kind: 'action' },
  { name: 'node', label: 'NODE Identity', category: 'Owner Control', description: 'Read IZAKHONO NODE identity and deployment capabilities through CONTROL.', kind: 'action' },
  { name: 'deploy-status', label: 'Deployment Status', category: 'Build & Deploy', description: 'Load recent IZAKHONO NODE deployment jobs through CONTROL.', kind: 'action' },
  { name: 'job', label: 'Deployment Job', category: 'Build & Deploy', description: 'Inspect one IZAKHONO NODE deployment job by ID.', kind: 'action', requiresArg: true },
  { name: 'deploy', label: 'Owned Production Deploy', category: 'Build & Deploy', description: 'Submit an approved immutable production deployment to IZAKHONO CONTROL → NODE.', kind: 'action', requiresArg: true },
  { name: 'commands', label: 'Command Catalogue', category: 'Owner Control', description: 'List the full IZAKHONO command catalogue.', kind: 'action', aliases: ['help'] },
];

const LAUNCHERS: CommandDefinition[] = [
  { name: 'kora', label: 'Open KORA', category: 'Platforms', description: 'Open KORA.', kind: 'launcher', path: '/kora' },
  { name: 'faisready', label: 'Open FAISReady', category: 'Platforms', description: 'Open FAISReady.', kind: 'launcher', path: '/faisready' },
  { name: 'worknow', label: 'Open WorkNow', category: 'Platforms', description: 'Open WorkNow.', kind: 'launcher', path: '/worknow' },
  { name: 'auto-ai', label: 'Open AUTO AI', category: 'Platforms', description: 'Open AUTO AI.', kind: 'launcher', path: '/auto-ai' },
  { name: 'allegro', label: 'Open Allegro', category: 'Platforms', description: 'Open Allegro.', kind: 'launcher', path: '/allegro' },
  { name: 'growth', label: 'Open Growth OS', category: 'Platforms', description: 'Open IZAKHONO Growth OS.', kind: 'launcher', path: '/growth' },
  { name: 'revenue', label: 'Open Revenue OS', category: 'Platforms', description: 'Open IZAKHONO Revenue OS.', kind: 'launcher', path: '/revenue' },
  { name: 'super-accountant', label: 'Open Super Accountant', category: 'Platforms', description: 'Open Super Accountant.', kind: 'launcher', path: '/super-accountant' },
  { name: 'studio', label: 'Open Studio', category: 'Platforms', description: 'Open IZAKHONO Studio.', kind: 'launcher', path: '/studio' },
  { name: 'edubuild', label: 'Open Edu-Build', category: 'Platforms', description: 'Open Edu-Build.', kind: 'launcher', path: '/edubuild' },
  { name: 'doxa-sure', label: 'Open DOXA-SURE', category: 'Platforms', description: 'Open DOXA-SURE.', kind: 'launcher', path: '/doxa-sure' },
];

const WORKFLOW_SETS: Record<string, string[]> = {
  'Marketing': [
    'instagram','facebook','linkedin','tiktok','youtube','reels','social','campaign','ad','ad-variants','content-plan','content-calendar','seo','keywords',
  ],
  'Sales': [
    'sales','offer','pricing','upsell','cross-sell','follow-up','proposal','quote','pitch','closing','objections','lead-nurture','sales-script','sales-funnel',
  ],
  'Brand': [
    'brand','positioning','tagline','brand-story','brand-voice','naming','visual-brief','brand-audit','messaging','value-proposition','elevator-pitch','brand-guidelines',
  ],
  'Customer': [
    'customer','audience','persona','journey','onboarding','retention','loyalty','feedback','survey','support','faq','reviews',
  ],
  'Research': [
    'competitor','market','market-size','trends','swot','opportunity','benchmark','gap-analysis','pricing-research','supplier-research','customer-research','validation-research',
  ],
  'Content': [
    'script','email','newsletter','blog','article','press-release','case-study','brochure','flyer','poster-copy','video-brief','podcast','webinar','presentation-copy',
  ],
  'Web & Product': [
    'website','landing-page','product-page','checkout','app','feature','roadmap','ux-audit','ui-brief','conversion-audit','signup-flow','share-button','analytics-plan','product-launch',
  ],
  'Operations': [
    'sop','process','workflow','checklist','operations-plan','quality-control','procurement','inventory','fulfilment','service-delivery','incident','handover',
  ],
  'Finance': [
    'budget','cashflow','forecast','break-even','margin','unit-economics','revenue-model','funding','investor-model','cost-cutting','invoice-plan','financial-dashboard',
  ],
  'Legal & Risk': [
    'terms','privacy','refund-policy','delivery-policy','risk-register','compliance-check','claims-check','contract-brief','due-diligence','data-map','security-review','disaster-recovery',
  ],
  'People': [
    'job-ad','role-profile','interview','onboarding-staff','training-plan','performance-plan','team-structure','org-chart','shift-plan','meeting-agenda','meeting-summary','delegation',
  ],
  'Education': [
    'course','lesson','curriculum','assessment','quiz','study-plan','facilitator-guide','learner-guide','rubric','certificate-plan','campus-plan','bursary-plan',
  ],
  'Media': [
    'tv-show','radio-show','episode','broadcast-grid','sponsorship','media-kit','artist-onboarding','rights-check','royalty-plan','event-broadcast','channel-launch','content-acquisition',
  ],
  'Infrastructure': [
    'dns','tls','deployment','hosting','ci','release','rollback','backup','monitoring','domain-cutover','incident-response','production-check',
  ],
  'Commerce': [
    'catalogue','product-bundle','store','merchant-check','payment-flow','abandoned-cart','promotion','coupon','subscription','booking-flow','order-flow','returns',
  ],
  'Owner Strategy': [
    'priority','revenue-priority','90-day-plan','weekly-plan','daily-plan','decision-brief','board-pack','investor-pack','partnership','acquisition-readiness','portfolio-review','owner-dashboard',
  ],
};

const STEP_LIBRARY: Record<string, string[]> = {
  'Marketing': ['Define the objective and target audience.', 'Build the channel-specific message and creative brief.', 'Set CTA, tracking and publishing cadence.', 'Review performance signals and iterate.'],
  'Sales': ['Define the buyer, offer and commercial objective.', 'Build the sales message, proof and objection handling.', 'Set pricing, CTA and follow-up sequence.', 'Track conversion and next action.'],
  'Brand': ['Define audience, promise and differentiator.', 'Build the messaging system and tone.', 'Translate it into visual/content guidance.', 'Check consistency across customer touchpoints.'],
  'Customer': ['Define the customer segment and desired outcome.', 'Map the customer journey and friction points.', 'Design the intervention and measurement.', 'Capture feedback and improve the next cycle.'],
  'Research': ['Define the research question and decision it supports.', 'Collect comparable evidence and constraints.', 'Separate facts, assumptions and gaps.', 'Produce implications and next actions.'],
  'Content': ['Define audience, objective and format.', 'Build the structure and key messages.', 'Create the first production-ready draft.', 'Add CTA, proof and distribution notes.'],
  'Web & Product': ['Define user goal and conversion goal.', 'Map the screen/feature flow and required data.', 'Specify build, analytics, payments and legal boundaries.', 'Set validation and launch gates.'],
  'Operations': ['Define trigger, owner and desired outcome.', 'Map the repeatable steps and control points.', 'Assign evidence, exceptions and escalation.', 'Measure completion, quality and turnaround time.'],
  'Finance': ['Define the financial decision and time horizon.', 'Collect assumptions, revenue and cost drivers.', 'Model the scenario and sensitivities.', 'Identify cash impact, risks and decision gates.'],
  'Legal & Risk': ['Define the activity, jurisdiction and exposure.', 'Identify required disclosures, controls and evidence.', 'Flag items requiring qualified professional review.', 'Record approval, version and implementation owner.'],
  'People': ['Define the role or people outcome.', 'Set responsibilities, criteria and process.', 'Create the communication/training material.', 'Track ownership, completion and feedback.'],
  'Education': ['Define learner profile and learning outcome.', 'Structure content, activity and assessment.', 'Set delivery resources and facilitator guidance.', 'Measure learner evidence and completion.'],
  'Media': ['Define audience, format, rights and commercial goal.', 'Design content, schedule and production workflow.', 'Set sponsorship, distribution and rights controls.', 'Track audience, revenue and content performance.'],
  'Infrastructure': ['Define the target environment and current state.', 'Inspect dependencies, credentials and failure points.', 'Execute the smallest reversible change.', 'Verify health, evidence and rollback readiness.'],
  'Commerce': ['Define product, buyer and transaction goal.', 'Build catalogue, pricing and checkout flow.', 'Set fulfilment, refund and customer communication.', 'Track checkout, payment and fulfilment evidence.'],
  'Owner Strategy': ['Define the owner decision and desired outcome.', 'Rank constraints, dependencies and evidence.', 'Choose the smallest high-leverage next actions.', 'Set accountable owners, checkpoints and proof of completion.'],
};

const WORKFLOWS: CommandDefinition[] = Object.entries(WORKFLOW_SETS).flatMap(([category, names]) =>
  names.map(name => ({
    name,
    label: title(name),
    category,
    description: `${title(name)} workflow with structured inputs, execution steps, controls and next actions.`,
    kind: 'workflow' as const,
    steps: STEP_LIBRARY[category],
  }))
);

const unique = new Map<string, CommandDefinition>();
for (const command of [...ACTIONS, ...LAUNCHERS, ...WORKFLOWS]) {
  if (!unique.has(command.name)) unique.set(command.name, command);
}

export const COMMANDS: CommandDefinition[] = Array.from(unique.values());

export function findCommand(input: string): CommandDefinition | null {
  const raw = input.trim().toLowerCase().replace(/^\/+/, '');
  const name = raw.split(/\s+/)[0];
  for (const command of COMMANDS) {
    if (command.name === name || command.aliases?.includes(name)) return command;
  }
  return null;
}

export function commandSummary(command: CommandDefinition) {
  return {
    name: command.name,
    label: command.label,
    category: command.category,
    description: command.description,
    kind: command.kind,
    requiresArg: Boolean(command.requiresArg),
    aliases: command.aliases || [],
    path: command.path || null,
    steps: command.steps || [],
  };
}

export function commandStats() {
  return {
    total: COMMANDS.length,
    actions: COMMANDS.filter(c => c.kind === 'action').length,
    launchers: COMMANDS.filter(c => c.kind === 'launcher').length,
    workflows: COMMANDS.filter(c => c.kind === 'workflow').length,
    categories: new Set(COMMANDS.map(c => c.category)).size,
  };
}
