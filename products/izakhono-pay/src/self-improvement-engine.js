/**
 * IZAKHONO PAY™ Self-Improvement Engine
 *
 * Evidence-driven optimization primitives. This engine may observe, score,
 * propose and test improvements, but it cannot authorize regulated live-money
 * changes or bypass activation gates.
 */

export const IMPROVEMENT_STAGES = Object.freeze([
  'observe','measure','detect','propose','sandbox','test','security_review',
  'approval','release','verify','learn'
]);

export const CHANGE_CLASSES = Object.freeze({
  LOW_RISK: 'low_risk',
  OPERATIONAL: 'operational',
  PAYMENT_ROUTING: 'payment_routing',
  SECURITY: 'security',
  REGULATED_LIVE_MONEY: 'regulated_live_money'
});

const FORBIDDEN_AUTOMATION_CLASSES = new Set([
  CHANGE_CLASSES.REGULATED_LIVE_MONEY
]);

export function createObservation(input = {}) {
  if (!input.metric || !input.value && input.value !== 0) throw new Error('observation_requires_metric_and_value');
  return Object.freeze({
    id: input.id || `obs_${crypto.randomUUID()}`,
    metric: String(input.metric),
    value: Number(input.value),
    unit: input.unit || null,
    source: input.source || 'unknown',
    observed_at: input.observed_at || new Date().toISOString(),
    metadata: input.metadata || {}
  });
}

export function detectOpportunity(observations, policy = {}) {
  const minimum = Number(policy.minimum_improvement_percent ?? 5);
  const baseline = Number(policy.baseline ?? 0);
  const current = Number(policy.current ?? 0);
  if (!Number.isFinite(baseline) || !Number.isFinite(current)) throw new Error('invalid_detection_values');
  const improvement = baseline === 0 ? null : ((current - baseline) / Math.abs(baseline)) * 100;
  return {
    detected: improvement !== null && Math.abs(improvement) >= minimum,
    metric: observations?.[0]?.metric || policy.metric || null,
    baseline,
    current,
    improvement_percent: improvement,
    reason: improvement === null ? 'baseline_required' : Math.abs(improvement) >= minimum ? 'threshold_reached' : 'below_threshold'
  };
}

export function proposeImprovement(input = {}) {
  const changeClass = input.change_class || CHANGE_CLASSES.LOW_RISK;
  if (!Object.values(CHANGE_CLASSES).includes(changeClass)) throw new Error('unknown_change_class');
  return Object.freeze({
    id: input.id || `imp_${crypto.randomUUID()}`,
    title: String(input.title || 'Untitled improvement'),
    hypothesis: String(input.hypothesis || ''),
    change_class: changeClass,
    expected_impact: input.expected_impact || null,
    evidence_ids: Array.isArray(input.evidence_ids) ? [...input.evidence_ids] : [],
    rollback_plan: input.rollback_plan || null,
    stage: 'propose',
    live_authorization_required: FORBIDDEN_AUTOMATION_CLASSES.has(changeClass),
    created_at: new Date().toISOString()
  });
}

export function evaluateChangeSafety(proposal, context = {}) {
  const blockers = [];
  if (!proposal?.rollback_plan) blockers.push('rollback_plan_required');
  if (!proposal?.evidence_ids?.length) blockers.push('evidence_required');
  if (FORBIDDEN_AUTOMATION_CLASSES.has(proposal?.change_class)) blockers.push('human_and_regulatory_approval_required');
  if (context.live_money_movement === true) blockers.push('live_money_movement_must_remain_gated');
  return {
    safe_for_sandbox: blockers.length === 0,
    blockers,
    stage: blockers.length === 0 ? 'sandbox' : 'security_review'
  };
}

export function advanceImprovement(proposal, targetStage, context = {}) {
  if (!IMPROVEMENT_STAGES.includes(targetStage)) throw new Error('unknown_improvement_stage');
  const currentIndex = IMPROVEMENT_STAGES.indexOf(proposal.stage);
  const targetIndex = IMPROVEMENT_STAGES.indexOf(targetStage);
  if (targetIndex < currentIndex) throw new Error('improvement_stage_cannot_move_backward');

  const safety = evaluateChangeSafety(proposal, context);
  if (targetStage === 'release' && !context.release_approved) throw new Error('release_approval_required');
  if (targetStage === 'release' && proposal.live_authorization_required && context.live_gate_decision !== 'GO') {
    throw new Error('live_gate_go_required');
  }
  if (targetStage === 'sandbox' && !safety.safe_for_sandbox) throw new Error(`sandbox_blocked:${safety.blockers.join(',')}`);

  return Object.freeze({
    ...proposal,
    stage: targetStage,
    updated_at: new Date().toISOString()
  });
}

export function rankOpportunities(opportunities = []) {
  return [...opportunities].sort((a, b) => {
    const score = (x) => Number(x.expected_impact_score || 0) * Number(x.confidence || 0) - Number(x.risk_score || 0);
    return score(b) - score(a);
  });
}

export function buildImprovementCycle({ observations = [], opportunities = [], release = null } = {}) {
  return {
    cycle_id: `cycle_${crypto.randomUUID()}`,
    stage: 'observe',
    observation_count: observations.length,
    opportunity_count: opportunities.length,
    ranked_opportunities: rankOpportunities(opportunities),
    release: release ? { approved: Boolean(release.approved), live_money_movement: false } : null,
    rule: 'observe → measure → detect → propose → sandbox → test → security_review → approval → release → verify → learn',
    live_authorization: 'external_gate_required'
  };
}
