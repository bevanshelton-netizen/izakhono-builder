import test from 'node:test';
import assert from 'node:assert/strict';
import { runOptimizationCycle } from '../src/optimization-runner.js';

function adapter() {
  const calls = { snapshots: 0, experiments: 0, runs: 0 };
  return {
    calls,
    async insertSnapshot(record) { calls.snapshots++; return { id: 'snap-1', record }; },
    async insertExperiment(record) { calls.experiments++; return { id: `exp-${calls.experiments}`, record }; },
    async insertRun(record) { calls.runs++; return { id: 'run-1', record }; }
  };
}

test('runner persists one sandbox cycle', async () => {
  const persistence = adapter();
  const result = await runOptimizationCycle({
    input: {
      cycle_key: '2026-10-26T15',
      candidates: [{ id: 'c1', title: 'Improve success', metric: 'success', expected_impact_score: 90, confidence: 90, evidence_ids: ['e1'], rollback_plan: 'restore' }]
    },
    persistence
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.experiments_created, 1);
  assert.equal(result.live_money_movement, false);
  assert.equal(result.authorization_mode, 'sandbox_only');
  assert.deepEqual(persistence.calls, { snapshots: 1, experiments: 1, runs: 1 });
});

test('runner is idempotent when cycle already exists', async () => {
  const persistence = adapter();
  const result = await runOptimizationCycle({
    input: { cycle_key: 'same-cycle', candidates: [] },
    persistence,
    lookupCycle: async () => ({ id: 'existing-run' })
  });
  assert.equal(result.status, 'duplicate');
  assert.equal(result.cycle_id, 'opt_platform_same-cycle');
  assert.deepEqual(persistence.calls, { snapshots: 0, experiments: 0, runs: 0 });
});
