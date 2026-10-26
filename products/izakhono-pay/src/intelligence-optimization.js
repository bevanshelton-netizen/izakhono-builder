/**
 * IZAKHONO PAY™ Intelligence & Optimization Control Plane
 *
 * Converts privacy-filtered operational telemetry into comparable health
 * signals, ranked optimization candidates and sandbox experiments.
 * It is deliberately provider-neutral and fail-closed: it never authorizes
 * regulated live-money changes.
 */

import { CHANGE_CLASSES, rankOpportunities } from './self-improvement-engine.js';

export const SIGNALS = Object.freeze({
  PAYMENT_SUCCESS: 'payment_success_rate',
  CHECKOUT_CONVERSION: 'checkout_conversion_rate',
  ROUTE_LATENCY: 'route_latency_ms',
  FAILURE_RATE: 'payment_failure_rate',
  RECONCILIATION_EXCEPTION_RATE: 'reconciliation_exception_rate',
  FRAUD_REVIEW_RATE: 'fraud_review_rate',
  OPERATIONAL_ALERT_RATE: 'operational_alert_rate'
});

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));

export function normalizeMetric(metric = {}) {
  const value = Number(metric.value);
  if (!metric.name || !Number.isFinite(value)) throw new Error('metric_name_and_finite_value_required');
  const direction = metric.direction === 'lower_is_better' ? 'lower_is_better' : 'higher_is_better';
  return Object.freeze({
    name: String(metric.name),
    value,
    unit: metric.unit || null,
    direction,
    source: metric.source || 'telemetry',
    observed_at: metric.observed_at || new Date().toISOString(),
    scope: metric.scope || 'platform'
  });
}

export function calculateHealthScore(metrics = []) {
  const normalized = metrics.map(normalizeMetric);
  if (!normalized.length) return { score: null, metrics: [], status: 'insufficient_data' };
  const componentScores = normalized.map((metric) => {
    // Metrics may provide a 0-100 health score directly; otherwise interpret
    // a normalized rate/percentage as health. Lower-is-better values require
    // an explicit target/max to avoid guessing operational meaning.
    const score = metric.health_score !== undefined
      ? clamp(metric.health_score)
      : metric.direction === 'lower_is_better'
        ? clamp(100 - (metric.value / Number(metric.max || 100)) * 100)
        : clamp(metric.value);
    return { name: metric.name, score };
  });
  const score = componentScores.reduce((sum, item) => sum + item.score, 0) / componentScores.length;
  return {
    score: Number(score.toFixed(2)),
    status: score >= 90 ? 'excellent' : score >= 75 ? 'healthy' : score >= 60 ? 'watch' : 'degraded',
    components: componentScores
  };
}

export function detectSignals(current = {}, baseline = {}, policy = {}) {
  const threshold = Number(policy.threshold_percent ?? 5);
  const signals = [];
  for (const [name, currentValueRaw] of Object.entries(current)) {
    if (!(name in baseline)) continue;
    const currentValue = Number(currentValueRaw);
    const baselineValue = Number(baseline[name]);
    if (!Number.isFinite(currentValue) || !Number.isFinite(baselineValue) || baselineValue === 0) continue;
    const changePercent = ((currentValue - baselineValue) / Math.abs(baselineValue)) * 100;
    if (Math.abs(changePercent) >= threshold) {
      signals.push({ name, baseline: baselineValue, current: currentValue, change_percent: Number(changePercent.toFixed(2)), direction: changePercent >= 0 ? 'up' : 'down' });
    }
  }
  return signals.sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent));
}

export function createOptimizationCandidate(input = {}) {
  if (!input.title || !input.metric) throw new Error('candidate_title_and_metric_required');
  const changeClass = input.change_class || CHANGE_CLASSES.LOW_RISK;
  if (!Object.values(CHANGE_CLASSES).includes(changeClass)) throw new Error('unknown_change_class');
  return Object.freeze({
    id: input.id || `opt_${crypto.randomUUID()}`,
    title: String(input.title),
    metric: String(input.metric),
    hypothesis: String(input.hypothesis || ''),
    expected_impact_score: clamp(input.expected_impact_score ?? 0),
    confidence: clamp(input.confidence ?? 0) / 100,
    risk_score: clamp(input.risk_score ?? 0),
    change_class: changeClass,
    evidence_ids: Array.isArray(input.evidence_ids) ? [...input.evidence_ids] : [],
    rollback_plan: input.rollback_plan || null,
    guardrails: Array.isArray(input.guardrails) ? [...input.guardrails] : [],
    live_authorization_required: changeClass === CHANGE_CLASSES.REGULATED_LIVE_MONEY,
    stage: 'candidate'
  });
}

export function rankOptimizationCandidates(candidates = []) {
  return rankOpportunities(candidates).map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

export function createExperiment(candidate, input = {}) {
  if (!candidate?.id) throw new Error('candidate_required');
  if (!candidate.rollback_plan) throw new Error('rollback_plan_required');
  if (!candidate.evidence_ids?.length) throw new Error('evidence_required');
  const sampleSize = Number(input.minimum_sample_size ?? 100);
  if (!Number.isInteger(sampleSize) || sampleSize < 1) throw new Error('valid_sample_size_required');
  return Object.freeze({
    id: input.id || `exp_${crypto.randomUUID()}`,
    candidate_id: candidate.id,
    baseline: input.baseline ?? null,
    target: input.target ?? null,
    guardrails: [...(candidate.guardrails || []), ...(input.guardrails || [])],
    minimum_sample_size: sampleSize,
    observation_window: input.observation_window || '24h',
    rollback_criteria: input.rollback_criteria || ['guardrail_breach'],
    stage: 'sandbox',
    live_money_movement: false,
    authorization: 'sandbox_only'
  });
}

export function evaluateExperiment(experiment, result = {}) {
  const guardrailsBreached = Array.isArray(result.guardrails_breached) && result.guardrails_breached.length > 0;
  const sampleSize = Number(result.sample_size || 0);
  const sufficientSample = sampleSize >= Number(experiment.minimum_sample_size);
  const targetReached = experiment.target !== null && result.value !== undefined
    ? Number(result.value) >= Number(experiment.target)
    : false;
  return {
    experiment_id: experiment.id,
    sufficient_sample: sufficientSample,
    guardrails_breached: guardrailsBreached,
    target_reached: targetReached,
    decision: guardrailsBreached ? 'ROLLBACK' : sufficientSample && targetReached ? 'PROMOTE_TO_REVIEW' : 'CONTINUE_SANDBOX',
    live_money_movement: false,
    live_authorization: 'external_gate_required'
  };
}

export function buildOptimizationSnapshot(input = {}) {
  const metrics = (input.metrics || []).map(normalizeMetric);
  const health = calculateHealthScore(metrics);
  const signals = detectSignals(input.current || {}, input.baseline || {}, input.policy || {});
  const candidates = rankOptimizationCandidates(input.candidates || []);
  return Object.freeze({
    snapshot_id: input.snapshot_id || `snap_${crypto.randomUUID()}`,
    generated_at: new Date().toISOString(),
    health,
    signals,
    candidates,
    control: {
      provider_neutral: true,
      privacy_filtered: true,
      live_money_movement: false,
      regulated_live_change: 'external_approval_required'
    }
  });
}
