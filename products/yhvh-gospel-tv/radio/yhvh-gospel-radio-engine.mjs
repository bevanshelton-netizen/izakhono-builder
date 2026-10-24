#!/usr/bin/env node
/**
 * YHVH Gospel Radio Engine
 * Continuous audio playout, station handoff, scheduling and stream fan-out.
 */

export class YhvhRadioEngine {
  constructor({ stationId, timezone = 'Africa/Johannesburg', playlist = [], now = () => new Date() } = {}) {
    if (!stationId) throw new Error('stationId required');
    this.stationId = stationId;
    this.timezone = timezone;
    this.playlist = playlist;
    this.index = 0;
    this.running = false;
    this.now = now;
  }

  start() { this.running = true; return this.snapshot(); }
  stop() { this.running = false; return this.snapshot(); }

  next() {
    if (!this.playlist.length) return null;
    const item = this.playlist[this.index % this.playlist.length];
    this.index += 1;
    return item;
  }

  streamConfig({ hlsDir = '/app/radio-hls', rtmpUrl = null, icecastUrl = null } = {}) {
    const outputs = [];
    outputs.push({ type: 'HLS', target: hlsDir });
    if (rtmpUrl) outputs.push({ type: 'RTMP', target: rtmpUrl });
    if (icecastUrl) outputs.push({ type: 'ICECAST', target: icecastUrl });
    return { stationId: this.stationId, outputs };
  }

  snapshot() {
    return {
      engine: 'YHVH Gospel Radio Engine',
      authority: 'IZAKHONO',
      stationId: this.stationId,
      timezone: this.timezone,
      running: this.running,
      playlistCount: this.playlist.length,
      currentIndex: this.playlist.length ? this.index % this.playlist.length : null,
      generatedAt: this.now().toISOString()
    };
  }
}
