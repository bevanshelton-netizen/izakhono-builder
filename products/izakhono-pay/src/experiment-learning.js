/**
 * IZAKHONO PAY™ Experiment Evaluation & Learning
 *
 * Evaluates sandbox experiments against sample-size and guardrail rules,
 * persists outcomes through a trusted adapter, and produces feedback for the
 * next optimization cycle. It never authorizes regulated live-money changes.
 */
import { evaluateExperiment } from './intelligence-optimization.js';

export const LEARNING_POLICY = Object.freeze({
  max_evaluations_per_cycle: 25,
  live_money_movement: false,
  authorization_mode: 'sandbox_only',
  regulated_live_authorization: 'external_gate_required'
});

export function evaluateSandboxExperiment(experiment, observation = {}) {
  if (!experiment || typeof experiment !== 'object') throw new Error('experiment_required');
  const evaluation = evaluateExperiment(experiment, observation);
  return Object.freeze({
    ...evaluation,
    evaluated_at: new Date().toISOString(),
    outcome: evaluation.decision === 'ROLLBACK'
      ? 'rollback'
      : evaluation.decision === 'PROMOTE_TO_REVIEW'
        ? 'promote_to_review'
        : 'continue_sandbox',
    live_money_movement: false,
    authorization_mode: 'sandbox_only',
    learning_feedback: {
      reusable: evaluation.decision !== 'ROLLBACK',
      next_cycle_action: evaluation.decision === 'PROMOTE_TO_REVIEW'
        ? 'require_external_review'
        : evaluation.decision === 'ROLLBACK'
          ? 'exclude_candidate_until_reassessed'
          : 'continue_observation'
    }
  });
}

export async function evaluateLearningCycle({ experiments = [], observations = {}, persistence, policy = LEARNING_POLICY } = {}) {
  if (!persistence || typeof persistence.insertOutcome !== 'function') throw new Error('outcome_persistence_required');
  const selected = experiments.slice(0, policy.max_evaluations_per_cycle);
  const outcomes = [];
  for (const experiment of selected) {
    const observation = observations[experiment.id] || {};
    const outcome = evaluateSandboxExperiment(experiment, observation);
    const persisted = await persistence.insertOutcome({
      experiment_id: experiment.id,
      candidate_id: experiment.candidate_id || null,
      decision: outcome.decision,
      outcome: outcome.outcome,
      sample_size: Number(observation.sample_size || 0),
      observation: observation,
      evaluation: outcome,
      live_money_movement: false,
      authorization_mode: 'sandbox_only'
    });
    outcomes.push({ ...outcome, outcome_id: persisted?.id || null });
  }
  return Object.freeze({
    evaluated: outcomes.length,
    outcomes,
    control: {
      live_money_movement: false,
      authorization_mode: 'sandbox_only',
      regulated_live_authorization: 'external_gate_required'
    }
  });
}
