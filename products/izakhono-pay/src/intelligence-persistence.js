/**
 * Persistence contract for the IZAKHONO PAY intelligence control plane.
 * The caller supplies its trusted database adapter; this module contains no
 * credentials and never enables live money movement.
 */

export function buildSnapshotRecord(snapshot, snapshotKey = snapshot?.snapshot_id) {
  if (!snapshot?.snapshot_id || !snapshotKey) throw new Error('snapshot_required');
  return {
    snapshot_key: String(snapshotKey),
    scope: snapshot.health?.scope || 'platform',
    health_score: snapshot.health?.score ?? null,
    health_status: snapshot.health?.status || 'insufficient_data',
    signals: snapshot.signals || [],
    candidates: snapshot.candidates || [],
    control: {
      ...(snapshot.control || {}),
      live_money_movement: false,
      regulated_live_change: 'external_approval_required'
    }
  };
}

export function buildExperimentRecord(experiment, candidate) {
  if (!experiment?.id || !candidate?.id) throw new Error('experiment_and_candidate_required');
  return {
    candidate_key: candidate.id,
    change_class: candidate.change_class,
    baseline: experiment.baseline,
    target: experiment.target,
    guardrails: experiment.guardrails || [],
    minimum_sample_size: experiment.minimum_sample_size,
    observation_window: experiment.observation_window,
    rollback_criteria: experiment.rollback_criteria || ['guardrail_breach'],
    stage: 'sandbox',
    live_money_movement: false,
    authorization_mode: 'sandbox_only'
  };
}

export function enforcePersistenceSafety(record = {}) {
  if (record.live_money_movement === true) throw new Error('persistence_live_money_movement_forbidden');
  if (record.authorization_mode && record.authorization_mode !== 'sandbox_only') {
    throw new Error('persistence_authorization_must_be_sandbox_only');
  }
  return Object.freeze({ ...record, live_money_movement: false, authorization_mode: 'sandbox_only' });
}
