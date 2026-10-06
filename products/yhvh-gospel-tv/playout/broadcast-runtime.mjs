import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const VIDEO_EXT = /\.(mp4|mkv|mov|webm|m4v)$/i;

export class YhvhBroadcastRuntime {
  constructor({ vaultDir, hlsDir, rightsManifestPath, territory = 'ZA', outputUrl = '' } = {}) {
    this.vaultDir = vaultDir || process.env.YHVH_CONTENT_VAULT || path.join(process.cwd(), 'content-vault');
    this.hlsDir = hlsDir || process.env.YHVH_HLS_DIR || path.join(process.cwd(), 'data', 'hls');
    this.rightsManifestPath = rightsManifestPath || process.env.YHVH_BROADCAST_MANIFEST || path.join(process.cwd(), 'playout', 'broadcast-inputs.json');
    this.territory = territory || process.env.YHVH_BROADCAST_TERRITORY || 'ZA';
    this.outputUrl = outputUrl || process.env.YHVH_RTMP_URL || '';
    this.child = null;
    this.startedAt = null;
    this.lastExit = null;
    this.lastStderr = '';
  }

  loadManifest() {
    return JSON.parse(fs.readFileSync(this.rightsManifestPath, 'utf8'));
  }

  approvedInputs() {
    const manifest = this.loadManifest();
    const rows = Array.isArray(manifest.items) ? manifest.items : [];
    const root = path.resolve(this.vaultDir) + path.sep;
    return rows.filter((x) => {
      if (!x || x.status !== 'READY' || x.rightsStatus !== 'CLEAR' || x.qcStatus !== 'PASS') return false;
      if (!Array.isArray(x.territories) || !x.territories.includes(this.territory)) return false;
      const mediaPath = path.resolve(this.vaultDir, x.path || '');
      return mediaPath.startsWith(root) && fs.existsSync(mediaPath) && VIDEO_EXT.test(mediaPath);
    }).map((x) => ({ ...x, mediaPath: path.resolve(this.vaultDir, x.path) }));
  }

  buildConcatFile(inputs) {
    fs.mkdirSync(this.hlsDir, { recursive: true });
    const concatPath = path.join(this.hlsDir, 'playout.concat.txt');
    const body = inputs.map((x) => `file '${x.mediaPath.replaceAll("'", "'\\''")}'`).join('\n') + '\n';
    fs.writeFileSync(concatPath, body, 'utf8');
    return concatPath;
  }

  command(inputs) {
    if (!inputs.length) throw new Error('broadcast_blocked_no_cleared_qc_content');
    const concat = this.buildConcatFile(inputs);
    const hlsPlaylist = path.join(this.hlsDir, 'playlist.m3u8');
    const outputs = `[f=hls:hls_time=6:hls_list_size=10:hls_flags=delete_segments+append_list]${hlsPlaylist}` +
      (this.outputUrl ? `|[f=flv]${this.outputUrl}` : '');
    const args = [
      '-hide_banner', '-loglevel', 'warning',
      '-re', '-stream_loop', '-1', '-f', 'concat', '-safe', '0', '-i', concat,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '3500k', '-maxrate', '4000k', '-bufsize', '7000k',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
      '-f', 'tee', outputs
    ];
    return { bin: 'ffmpeg', args, hlsPlaylist };
  }

  start() {
    if (this.child) return { ok: true, alreadyRunning: true, pid: this.child.pid };
    const inputs = this.approvedInputs();
    const cmd = this.command(inputs);
    this.child = spawn(cmd.bin, cmd.args, { stdio: ['ignore', 'ignore', 'pipe'] });
    this.startedAt = new Date().toISOString();
    this.lastExit = null;
    this.lastStderr = '';
    this.child.stderr.on('data', (b) => { this.lastStderr = (this.lastStderr + String(b)).slice(-4000); });
    this.child.on('exit', (code, signal) => {
      this.lastExit = { code, signal, at: new Date().toISOString() };
      this.child = null;
    });
    return { ok: true, started: true, pid: this.child.pid, inputCount: inputs.length, hls: '/hls/playlist.m3u8', outputConfigured: Boolean(this.outputUrl) };
  }

  stop() {
    if (!this.child) return { ok: true, stopped: false, reason: 'not_running' };
    this.child.kill('SIGTERM');
    return { ok: true, stopped: true };
  }

  snapshot() {
    let inputCount = 0;
    let manifestError = null;
    try { inputCount = this.approvedInputs().length; } catch (e) { manifestError = e?.message || 'manifest_error'; }
    return {
      running: Boolean(this.child),
      pid: this.child?.pid || null,
      startedAt: this.startedAt,
      lastExit: this.lastExit,
      territory: this.territory,
      approvedInputCount: inputCount,
      outputConfigured: Boolean(this.outputUrl),
      hlsReady: fs.existsSync(path.join(this.hlsDir, 'playlist.m3u8')),
      manifestError,
      lastStderr: this.lastStderr || null
    };
  }
}

export function createBroadcastRuntime(options) { return new YhvhBroadcastRuntime(options); }
