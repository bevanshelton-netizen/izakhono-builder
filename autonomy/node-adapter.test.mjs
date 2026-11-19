import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runNodeAdapter } from './node-adapter.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'izakhono-kora-test-'));
const previous = {
  dryRun: process.env.IZAKHONO_DRY_RUN,
  nodeId: process.env.IZAKHONO_NODE_ID,
  statePath: process.env.IZAKHONO_WORKLOAD_EXECUTION_STATE_PATH,
};
try {
  process.env.IZAKHONO_DRY_RUN = 'true';
  process.env.IZAKHONO_NODE_ID = 'test-software-node';
  process.env.IZAKHONO_WORKLOAD_EXECUTION_STATE_PATH = path.join(temp, 'workload-execution.json');

  const execution = await runNodeAdapter('kora-workload-execute');
  assert.equal(execution.status, 'waiting');
  assert.equal(execution.reason, 'kora-runtime-execution-requires-eligible-node');
  assert.equal(execution.acceptance, 'not-verified');

  const routing = await runNodeAdapter('kora-routing-acceptance');
  assert.equal(routing.status, 'waiting');
  assert.equal(routing.reason, 'kora-runtime-not-accepted');
  assert.equal(routing.acceptance, 'pending');

  assert.ok(fs.existsSync(process.env.IZAKHONO_WORKLOAD_EXECUTION_STATE_PATH));
  console.log('KORA execution and routing remain safely gated until independent runtime, TLS and rollback evidence exists.');
} finally {
  if (previous.dryRun === undefined) delete process.env.IZAKHONO_DRY_RUN; else process.env.IZAKHONO_DRY_RUN = previous.dryRun;
  if (previous.nodeId === undefined) delete process.env.IZAKHONO_NODE_ID; else process.env.IZAKHONO_NODE_ID = previous.nodeId;
  if (previous.statePath === undefined) delete process.env.IZAKHONO_WORKLOAD_EXECUTION_STATE_PATH; else process.env.IZAKHONO_WORKLOAD_EXECUTION_STATE_PATH = previous.statePath;
  fs.rmSync(temp, { recursive: true, force: true });
}
