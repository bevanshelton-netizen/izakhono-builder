import assert from 'node:assert/strict';
import { createNodeMediaExportRuntime } from './media-export-node-runtime';

async function run() {

const runtime = createNodeMediaExportRuntime({ timeoutMs: 5000 });
const result = await runtime.run(process.execPath, ['-e', 'process.stdout.write("node-media-worker-ok")']);
assert.equal(result.stdout, 'node-media-worker-ok');
assert.equal(result.stderr, '');
await assert.rejects(
  () => runtime.run(process.execPath, ['-e', 'process.stderr.write("intentional failure"); process.exit(7)']),
  /exited with code 7/,
);
await assert.rejects(
  () => runtime.run(process.execPath, ['-e', 'setTimeout(() => {}, 10000)']),
  /execution limit/,
);
console.log('IZAKHONO Creator Node FFmpeg process adapter: PASS');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
