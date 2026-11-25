import assert from 'node:assert/strict';
import { FACEBOOK_REELS_1080X1920, buildFfmpegExportArgs, validateMediaProbe, validateMp4FastStart } from './media-export-profile';

const goodProbe = {
  streams: [
    { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, pix_fmt: 'yuv420p', avg_frame_rate: '30/1' },
    { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2, channel_layout: 'stereo' },
  ],
  format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '92.4' },
};
const good = validateMediaProbe(goodProbe);
assert.equal(good.passed, true);
assert.equal(good.profileId, FACEBOOK_REELS_1080X1920.id);
assert.ok(good.manualChecksRequired.length >= 5);

const wrongDimensions = validateMediaProbe({
  ...goodProbe,
  streams: goodProbe.streams.map(stream => stream.codec_type === 'video' ? { ...stream, width: 1920, height: 1080 } : stream),
});
assert.equal(wrongDimensions.passed, false);
assert.ok(wrongDimensions.checks.some(check => check.id === 'video-dimensions' && !check.passed));

const missingAudio = validateMediaProbe({ ...goodProbe, streams: goodProbe.streams.filter(stream => stream.codec_type !== 'audio') });
assert.equal(missingAudio.passed, false);
assert.ok(missingAudio.checks.some(check => check.id === 'audio-stream-present' && !check.passed));

const duplicateAudio = validateMediaProbe({ ...goodProbe, streams: [...goodProbe.streams, { ...goodProbe.streams[1] }] });
assert.equal(duplicateAudio.passed, false);
assert.ok(duplicateAudio.checks.some(check => check.id === 'audio-stream-count' && !check.passed));
const duplicateVideo = validateMediaProbe({ ...goodProbe, streams: [...goodProbe.streams, { ...goodProbe.streams[0] }] });
assert.equal(duplicateVideo.passed, false);
assert.ok(duplicateVideo.checks.some(check => check.id === 'video-stream-count' && !check.passed));

function box(type: string, payload: number[] = []): number[] {
  const size = payload.length + 8;
  return [(size >>> 24) & 255, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, ...Array.from(type).map(char => char.charCodeAt(0)), ...payload];
}
const fastStartBytes = new Uint8Array([...box('ftyp'), ...box('moov', [1, 2, 3, 4]), ...box('mdat', [5, 6, 7, 8])]);
assert.equal(validateMp4FastStart(fastStartBytes).passed, true);
const slowStartBytes = new Uint8Array([...box('ftyp'), ...box('mdat', [5, 6, 7, 8]), ...box('moov', [1, 2, 3, 4])]);
assert.equal(validateMp4FastStart(slowStartBytes).passed, false);
assert.equal(validateMp4FastStart(new Uint8Array([0, 1, 2])).passed, false);
const malformedBytes = new Uint8Array([0, 0, 0, 2, 102, 116, 121, 112]);
assert.equal(validateMp4FastStart(malformedBytes).passed, false);

const args = buildFfmpegExportArgs('/staging/master.mov', '/exports/facebook-reels.mp4');
assert.ok(args.includes('+faststart'));
assert.ok(args.includes('yuv420p'));
assert.ok(args.includes('48000'));
assert.equal(args.at(-1), '/exports/facebook-reels.mp4');
assert.throws(() => buildFfmpegExportArgs(' ', '/exports/out.mp4'));
assert.throws(() => buildFfmpegExportArgs('/staging/master.mov', '/staging/master.mov'), /must be different/);

console.log('IZAKHONO Creator reusable Facebook export profile and media QA: PASS');
