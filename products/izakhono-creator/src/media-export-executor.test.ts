import assert from 'node:assert/strict';
import { executeMediaExport, exportAndStore, type MediaExportRuntime } from './media-export-executor';

async function run() {

function box(type: string, payload: number[] = []): number[] {
  const size = payload.length + 8;
  return [(size >>> 24) & 255, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, ...Array.from(type).map(char => char.charCodeAt(0)), ...payload];
}
const validBytes = new Uint8Array([...box('ftyp'), ...box('moov', [1,2,3,4]), ...box('mdat', [5,6,7,8])]);
const goodProbe = JSON.stringify({
  streams: [
    { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, pix_fmt: 'yuv420p', avg_frame_rate: '30/1' },
    { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2 },
  ],
  format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '12.5' },
});
const commands: Array<{ command: string; args: string[] }> = [];
let outputBytes = validBytes;
const runtime: MediaExportRuntime = {
  async run(command, args) {
    commands.push({ command, args });
    return { stdout: command === 'ffprobe' ? goodProbe : '', stderr: '' };
  },
  async readFile() { return outputBytes; },
  async writeFile(_path, bytes) { outputBytes = bytes; },
  async sha256(bytes) {
    assert.equal(bytes.byteLength, validBytes.byteLength);
    return 'a'.repeat(64);
  },
};

const result = await executeMediaExport({
  sourcePath: '/work/master.mp4',
  outputPath: '/work/facebook.mp4',
  recordedBy: 'creator-media-worker-test',
}, runtime, () => '2026-11-26T09:00:00.000Z');
assert.equal(result.status, 'qa_passed');
assert.equal(result.mediaQa.passed, true);
assert.equal(result.mediaQa.schema, 'izakhono.creator/media-qa-evidence-v1');
assert.equal(result.mediaQa.assetContentHash, 'a'.repeat(64));
assert.ok(result.mediaQa.checks.some(check => check.id === 'mp4-fast-start' && check.passed));
assert.deepEqual(commands.map(item => item.command), ['ffmpeg', 'ffprobe']);
assert.ok(commands[0].args.includes('+faststart'));
assert.equal(commands[0].args.at(-1), '/work/facebook.mp4');
assert.equal(commands[1].args.at(-1), '/work/facebook.mp4');

await assert.rejects(() => executeMediaExport({
  sourcePath: '/work/master.mp4', outputPath: '/work/master.mp4', recordedBy: 'test',
}, runtime), /never overwrite/);
await assert.rejects(() => executeMediaExport({
  sourcePath: '/work/master.mp4', outputPath: '/work/out.mp4', recordedBy: ' ',
}, runtime), /identity/);

let stored = 0;
const store = { async put(key: string, bytes: Uint8Array, metadata: { contentType: string; sha256: string }) {
  stored++;
  assert.equal(key, 'projects/demo/exports/facebook.mp4');
  assert.equal(bytes.byteLength, validBytes.byteLength);
  assert.equal(metadata.contentType, 'video/mp4');
  assert.equal(metadata.sha256, 'a'.repeat(64));
} };
const storedResult = await exportAndStore({
  sourcePath: '/work/master.mp4', outputPath: '/work/facebook.mp4', recordedBy: 'test-worker',
}, runtime, store, 'projects/demo/exports/facebook.mp4');
assert.equal(storedResult.status, 'qa_passed');
assert.equal(stored, 1);

outputBytes = new Uint8Array([...box('ftyp'), ...box('mdat', [5,6,7,8]), ...box('moov', [1,2,3,4])]);
const slowStart = await executeMediaExport({
  sourcePath: '/work/master.mp4', outputPath: '/work/slow.mp4', recordedBy: 'test-worker',
}, runtime);
assert.equal(slowStart.status, 'qa_failed');
assert.equal(slowStart.mediaQa.passed, false);
assert.equal(slowStart.mediaQa.checks.find(check => check.id === 'mp4-fast-start')?.passed, false);

outputBytes = validBytes;
console.log('IZAKHONO Creator executable FFmpeg export, hash binding and storage gate: PASS');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
