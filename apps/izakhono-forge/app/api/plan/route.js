import { NextResponse } from 'next/server';

const classify = (text) => {
  const t = text.toLowerCase();
  if (/crm|customer|lead|sales pipeline/.test(t)) return 'CRM';
  if (/website|site|landing page|web/.test(t)) return 'WEBSITE';
  if (/app|mobile|software|portal|dashboard/.test(t)) return 'APP';
  if (/pdf|document|proposal|report|memo/.test(t)) return 'DOCUMENT';
  if (/presentation|slides|deck/.test(t)) return 'PRESENTATION';
  if (/marketing|advert|campaign|social|content/.test(t)) return 'MARKETING';
  if (/research|analyse|analyze|investigate/.test(t)) return 'RESEARCH';
  return 'BUSINESS_BUILD';
};

const planFor = (intent) => {
  const type = classify(intent);
  const common = [
    ['UNDERSTAND', 'Convert the request into a structured outcome contract.'],
    ['PLAN', 'Create scope, acceptance criteria, dependencies and a reversible execution plan.'],
    ['BUILD', 'Generate the smallest complete first version rather than wasting credits on speculative iterations.'],
    ['VERIFY', 'Run deterministic checks, security checks and output validation before release.'],
    ['PACKAGE', 'Produce the requested artifact plus machine-readable metadata and a change log.'],
  ];
  const extras = {
    WEBSITE: [['DESIGN', 'Generate responsive information architecture, copy blocks, SEO metadata and reusable components.'], ['PUBLISH', 'Prepare a deployment-ready site and keep publishing separate from content generation.']],
    APP: [['ARCHITECT', 'Select data model, routes, UI states, auth boundaries and integration contracts.'], ['TEST', 'Exercise critical user flows before deployment.']],
    CRM: [['MODEL', 'Provision tenant-safe companies, contacts, deals, tasks and activity objects.'], ['CONNECT', 'Leave payment, email, WhatsApp and AI adapters replaceable.']],
    DOCUMENT: [['STRUCTURE', 'Create professional sections, citations/inputs and revision checkpoints.'], ['EXPORT', 'Prepare print/web-ready output.']],
    PRESENTATION: [['STORY', 'Build executive narrative, visual hierarchy and evidence flow.'], ['EXPORT', 'Prepare presentation-ready slides and speaker notes.']],
    MARKETING: [['CAMPAIGN', 'Create audience, offer, channel, creative and measurement plan.'], ['MEASURE', 'Define conversion events and feedback loops.']],
    RESEARCH: [['RESEARCH', 'Break the question into evidence tasks and source requirements.'], ['SYNTHESIZE', 'Separate verified facts, assumptions and recommendations.']],
    BUSINESS_BUILD: [['ARCHITECT', 'Select the best IZAKHONO-owned product, data and infrastructure primitives.'], ['EXECUTE', 'Turn the plan into tracked work instead of returning another plan.']],
  }[type];
  return { type, stages: [...common.slice(0,2), ...extras, ...common.slice(2)], safety: ['No fabricated live/deployed claims', 'No secrets in browser code', 'External services remain replaceable', 'High-impact actions require explicit authorization'] };
};

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const intent = String(body.intent || '').trim();
  if (!intent) return NextResponse.json({ error: 'intent_required' }, { status: 400 });

  // Optional model-router handoff. The local planner remains functional when no model key is configured.
  const modelUrl = process.env.IZAKHONO_MODEL_ROUTER_URL;
  const modelKey = process.env.IZAKHONO_MODEL_ROUTER_KEY;
  if (modelUrl && modelKey) {
    try {
      const r = await fetch(modelUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${modelKey}` },
        body: JSON.stringify({ task: 'plan', intent, system: 'Return a concise structured execution plan. Do not claim actions not performed.' }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        const data = await r.json();
        return NextResponse.json({ source: 'model-router', intent, plan: data });
      }
    } catch {}
  }

  return NextResponse.json({ source: 'owned-local-planner', intent, plan: planFor(intent) });
}
