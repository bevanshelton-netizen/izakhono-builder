import fs from 'node:fs';
import path from 'node:path';

export class YhvhPlayoutEngine {
  constructor({ manifestPath, vaultDir = process.env.YHVH_CONTENT_VAULT || './content-vault' } = {}) {
    this.manifestPath = manifestPath || path.join(process.cwd(), 'playout', 'playlist.json');
    this.vaultDir = vaultDir;
    this.state = { index: 0, startedAt: new Date().toISOString(), current: null, lastGood: null, mode: 'CONTINUOUS' };
    this.manifest = this.loadManifest();
  }

  loadManifest() {
    const raw = fs.readFileSync(this.manifestPath, 'utf8');
    const manifest = JSON.parse(raw);
    if (!Array.isArray(manifest.items) || !manifest.items.length) throw new Error('playout_manifest_empty');
    return manifest;
  }

  readyItems() {
    return this.manifest.items.filter(x => x.status === 'READY' && x.uri && !x.uri.startsWith('CONTENT_VAULT:'));
  }

  vaultItems() {
    const dirs = fs.existsSync(this.vaultDir) ? fs.readdirSync(this.vaultDir, { withFileTypes: true }) : [];
    return dirs.filter(x => x.isFile() && /\.(mp4|mkv|mov|webm|m4v)$/i.test(x.name)).map(x => path.join(this.vaultDir, x.name));
  }

  next() {
    const item = this.manifest.items[this.state.index % this.manifest.items.length];
    this.state.index = (this.state.index + 1) % this.manifest.items.length;
    this.state.current = item;
    if (item.status === 'READY') this.state.lastGood = item;
    return item;
  }

  snapshot() {
    return {
      mode: this.state.mode,
      index: this.state.index,
      current: this.state.current,
      lastGood: this.state.lastGood,
      readyCount: this.readyItems().length,
      vaultMediaCount: this.vaultItems().length,
      manifestItems: this.manifest.items.length,
      startedAt: this.state.startedAt
    };
  }

  ffmpegArgs({ input, output, videoCodec = 'libx264', audioCodec = 'aac' }) {
    if (!input || !output) throw new Error('input_and_output_required');
    return [
      '-re', '-i', input,
      '-c:v', videoCodec, '-preset', 'veryfast', '-b:v', '3500k', '-maxrate', '4000k', '-bufsize', '7000k',
      '-c:a', audioCodec, '-b:a', '128k', '-ar', '48000',
      '-f', 'flv', output
    ];
  }

  ffmpegCommand({ input, output, videoCodec, audioCodec }) {
    return ['ffmpeg', ...this.ffmpegArgs({ input, output, videoCodec, audioCodec })];
  }
}

export function createPlayoutEngine(options) { return new YhvhPlayoutEngine(options); }
