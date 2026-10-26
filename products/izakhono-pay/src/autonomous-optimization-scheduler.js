/**
 * IZAKHONO PAY™ Autonomous Optimization Scheduler
 * Deterministic, fail-closed recurring intelligence cycle.
 * Learning feedback is advisory for sandbox prioritization only.
 */
import { buildOptimizationSnapshot, createExperiment, createOptimizationCandidate, rankOptimizationCandidates } from './intelligence-optimization.js';

export const SCHEDULER_POLICY = Object.freeze({ max_experiments_per_cycle: 3, minimum_confidence: 60, minimum_impact_score: 50, live_money_movement: false, authorization_mode: 'sandbox_only', regulated_live_authorization: 'external_gate_required' });

export function deterministicCycleId({ cycle_key, window_start, scope = 'platform' } = {}) {
  const key = String(cycle_key || window_start || 'unspecified');
  return `opt_${String(scope || 'platform')}_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function learningDecision(outcome = {}) {
  return String(outcome.decision || outcome.outcome || outcome.learning_feedback?.next_cycle_action || '').toLowerCase();
}

function applyLearningFeedback(candidates, learningOutcomes = []) {
  if (!Array.isArray(learningOutcomes) || learningOutcomes.length === 0) return candidates;
  const feedback = new Map();
  for (const outcome of learningOutcomes) {
    const id = outcome.candidate_id || outcome.experiment_candidate_id;
    if (id) feedback.set(String(id), learningDecision(outcome));
  }

  const eligible = candidates.filter((candidate) => learningDecision(feedback.get(String(candidate.id)) || {}) !== 'rollback');
  const promoted = [];
  const remaining = [];
  for (const candidate of eligible) {
    const decision = feedback.get(String(candidate.id));
    if (decision === 'promote_to_review' || decision === 'require_external_review') promoted.push(candidate);
    else remaining.push(candidate);
  }
  return [...promoted, ...remaining];
}

export function buildSchedulerCycle(input = {}, policy = SCHEDULER_POLICY) {
  if (!input || typeof input !== 'object') throw new Error('scheduler_input_required');
  if (!input.cycle_key && !input.window_start && !input.cycle_id) throw new Error('cycle_key_required');
  const candidates = (input.candidates || []).map(createOptimizationCandidate)
    .filter((candidate) => candidate.confidence * 100 >= policy.minimum_confidence)
    .filter((candidate) => candidate.expected_impact_score >= policy.minimum_impact_score);
  const ranked = applyLearningFeedback(rankOptimizationCandidates(candidates), input.learning_outcomes || input.learning_feedback || []);
  const experiments = [];
  const rejected = [];
  for (const candidate of ranked.slice(0, policy.max_experiments_per_cycle)) {
    try { experiments.push(createExperiment(candidate, { minimum_sample_size: input.minimum_sample_size || 100, observation_window: input.observation_window || '24h' })); }
    catch (error) { rejected.push({ candidate_id: candidate.id, reason: error.message }); }
  }
  const snapshot = buildOptimizationSnapshot({ metrics: input.metrics || [], current: input.current || {}, baseline: input.baseline || {}, policy: input.signal_policy || {}, candidates: ranked });
  return Object.freeze({ cycle_id: input.cycle_id || deterministicCycleId({ cycle_key: input.cycle_key, window_start: input.window_start, scope: input.scope }), generated_at: new Date().toISOString(), snapshot, experiments, rejected, learning_feedback_applied: Array.isArray(input.learning_outcomes || input.learning_feedback) && (input.learning_outcomes || input.learning_feedback).length > 0, policy: { ...policy, live_money_movement: false, authorization_mode: 'sandbox_only', regulated_live_authorization: 'external_gate_required' }, status: 'sandbox_ready' });
}

export function schedulerHealth(cycle = {}) {
  const experiments = Array.isArray(cycle.experiments) ? cycle.experiments : [];
  return { cycle_id: cycle.cycle_id || null, status: cycle.status || 'unknown', experiments_created: experiments.length, rejected_candidates: Array.isArray(cycle.rejected) ? cycle.rejected.length : 0, learning_feedback_applied: cycle.learning_feedback_applied === true, live_money_movement: false, authorization_mode: 'sandbox_only' };
}
