/**
 * IZAKHONO PAY™ Optimization Runner
 *
 * Provider-neutral adapter for recurring execution. The scheduler decides
 * what may be experimented with; this runner selects the verified telemetry
 * path and persists only fail-closed sandbox experiments.
 */

import { buildSchedulerCycle } from './autonomous-optimization-scheduler.js';
import { buildSnapshotRecord, buildExperimentRecord, enforcePersistenceSafety } from './intelligence-persistence.js';

function resolveMeasurementSource(input = {}, candidate = {}) {
  const requested = String(candidate.measurement_source || input.measurement_source || '').trim();
  if (requested === 'synthetic_sandbox') return 'synthetic_sandbox';
  if (requested === 'verified_production') return 'verified_production';
  throw new Error('verified_measurement_source_required');
}

function attachMeasurementSource(experiment, source) {
  return {
    ...experiment,
    measurement_source: source,
    live_money_movement: false,
    authorization: 'sandbox_only'
  };
}

export async function runOptimizationCycle({ input = {}, persistence, lookupCycle } = {}) {
  if (!persistence || typeof persistence.insertRun !== 'function') throw new Error('persistence_adapter_required');
  if (typeof persistence.insertSnapshot !== 'function') throw new Error('snapshot_persistence_required');
  if (typeof persistence.insertExperiment !== 'function') throw new Error('experiment_persistence_required');

  const cycle = buildSchedulerCycle(input);
  const existing = typeof lookupCycle === 'function' ? await lookupCycle(cycle.cycle_id) : null;
  if (existing) return { status: 'duplicate', cycle_id: cycle.cycle_id, existing };

  const snapshotRecord = enforcePersistenceSafety(buildSnapshotRecord(cycle.snapshot, cycle.cycle_id));
  const snapshot = await persistence.insertSnapshot(snapshotRecord);

  const experiments = [];
  const rejected = [...cycle.rejected];
  for (const experiment of cycle.experiments) {
    try {
      const source = resolveMeasurementSource(input, experiment);
      const sourcedExperiment = attachMeasurementSource(experiment, source);
      const record = enforcePersistenceSafety(buildExperimentRecord(sourcedExperiment, { id: experiment.candidate_id }));
      experiments.push(await persistence.insertExperiment(record));
    } catch (error) {
      rejected.push({ candidate_id: experiment.candidate_id, reason: error.message });
    }
  }

  const result = {
    cycle_id: cycle.cycle_id,
    snapshot_id: snapshot?.id || null,
    experiments_created: experiments.length,
    rejected_candidates: rejected.length,
    measurement_sources: [...new Set(experiments.map((item) => item?.measurement_source).filter(Boolean))],
    status: 'completed',
    live_money_movement: false,
    authorization_mode: 'sandbox_only',
    external_gate_required: true
  };

  const run = await persistence.insertRun({
    cycle_id: cycle.cycle_id,
    scope: input.scope || 'platform',
    window_start: input.window_start || null,
    window_end: input.window_end || null,
    status: result.status,
    snapshot_id: result.snapshot_id,
    experiments_created: result.experiments_created,
    rejected_candidates: result.rejected_candidates,
    result,
    live_money_movement: false,
    authorization_mode: 'sandbox_only'
  });

  return { ...result, run_id: run?.id || null };
}
