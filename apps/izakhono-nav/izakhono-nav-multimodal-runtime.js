/* IZAKHONO NAV — Multimodal Mobility Runtime v0.1
 * Software-first. Hardware integrations are optional adapters.
 * Never fabricates position, hazards, telemetry or operational status.
 */
(function () {
  'use strict';

  const state = {
    mode: 'UNAVAILABLE',
    dataQuality: 'NO_LIVE_FEED',
    activeMode: 'LAND',
    position: null,
    source: null,
    adapters: {},
    lastSync: null,
    error: null
  };

  const validModes = ['LAND', 'SEA', 'AIR'];

  function setMode(mode) {
    const next = String(mode || '').toUpperCase();
    if (!validModes.includes(next)) throw new Error('Unsupported NAV mode');
    state.activeMode = next;
    return snapshot();
  }

  function registerAdapter(name, adapter) {
    if (!name || !adapter || typeof adapter.read !== 'function') {
      throw new Error('Adapter requires a name and read() function');
    }
    state.adapters[name] = adapter;
    return Object.keys(state.adapters);
  }

  async function sync() {
    const candidates = Object.entries(state.adapters)
      .filter(([, adapter]) => adapter.modes ? adapter.modes.includes(state.activeMode) : true);

    if (!candidates.length) {
      state.mode = 'UNAVAILABLE';
      state.dataQuality = 'NO_LIVE_FEED';
      state.error = null;
      return snapshot();
    }

    for (const [name, adapter] of candidates) {
      try {
        const result = await adapter.read(state.activeMode);
        if (!result || result.verified !== true) continue;
        state.mode = 'LIVE';
        state.dataQuality = result.dataQuality || 'VERIFIED';
        state.position = result.position || null;
        state.source = name;
        state.lastSync = new Date().toISOString();
        state.error = null;
        return snapshot();
      } catch (error) {
        state.error = error && error.message ? error.message : 'Adapter unavailable';
      }
    }

    state.mode = 'UNAVAILABLE';
    state.dataQuality = 'NO_VERIFIED_DATA';
    return snapshot();
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  function loadDemo() {
    state.mode = 'DEMO';
    state.dataQuality = 'DEMO_ONLY';
    state.position = null;
    state.source = 'demo';
    state.lastSync = new Date().toISOString();
    state.error = null;
    return snapshot();
  }

  function clear() {
    state.mode = 'UNAVAILABLE';
    state.dataQuality = 'NO_LIVE_FEED';
    state.position = null;
    state.source = null;
    state.lastSync = null;
    state.error = null;
    return snapshot();
  }

  window.IZAKHONO_NAV_MULTIMODAL = {
    state: snapshot,
    setMode,
    registerAdapter,
    sync,
    loadDemo,
    clear
  };
})();