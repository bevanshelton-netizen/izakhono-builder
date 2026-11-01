/* SHELTON FREIGHT — Live Journey Execution Runtime
 * API-first. Explicit DEMO fallback. Never fabricates live GPS, ETA or dispatch.
 */
(function () {
  'use strict';

  const API = '/api/freight';
  const OUTBOX_KEY = 'shelton-freight-journey-outbox-v1';
  const JOURNEY_KEY = 'shelton-freight-active-journey-v1';
  const TERMINAL = new Set(['closed']);

  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  };
  const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const state = {
    mode: 'IDLE',
    status: 'assigned',
    journey: null,
    lastLocation: null,
    eta: { confidence: 'unavailable', eta_timestamp: null, distance_remaining_km: null, source: null },
    outbox: readJSON(OUTBOX_KEY, []),
    lastSync: null,
    error: null
  };

  const emit = () => window.dispatchEvent(new CustomEvent('shelton-freight-journey-state', { detail: { ...state } }));
  const persist = () => { writeJSON(OUTBOX_KEY, state.outbox); writeJSON(JOURNEY_KEY, state.journey); emit(); };

  async function post(path, payload) {
    const response = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json().catch(() => ({}));
  }

  function queue(path, payload, type) {
    state.outbox.push({
      event_id: `OUT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      path, type, payload, created_at: new Date().toISOString(), attempts: 0, sync_status: 'queued'
    });
    persist();
  }

  async function send(path, payload, type) {
    try {
      const result = await post(path, payload);
      state.mode = 'LIVE';
      state.error = null;
      return { live: true, result };
    } catch (error) {
      queue(path, payload, type);
      state.mode = state.mode === 'DEMO' ? 'DEMO' : 'OFFLINE';
      state.error = error.message;
      return { live: false, queued: true, error: error.message };
    }
  }

  async function flushOutbox() {
    if (!navigator.onLine || !state.outbox.length) return { synced: 0, remaining: state.outbox.length };
    let synced = 0;
    const remaining = [];
    for (const item of state.outbox) {
      try {
        await post(item.path, item.payload);
        synced += 1;
      } catch (_) {
        item.attempts += 1;
        item.sync_status = 'queued';
        remaining.push(item);
      }
    }
    state.outbox = remaining;
    state.lastSync = new Date().toISOString();
    persist();
    return { synced, remaining: remaining.length };
  }

  function validStart(input) {
    return !!(input && input.journey_id && input.vehicle_id && input.driver_id &&
      (input.gate_decision === 'READY' || input.pretrip_ready === true));
  }

  async function start(input) {
    if (!validStart(input)) return { ok: false, blocked: true, reason: 'Journey may only start from an authorized READY pre-trip state.' };
    state.journey = {
      journey_id: input.journey_id,
      vehicle_id: input.vehicle_id,
      driver_id: input.driver_id,
      started_at: new Date().toISOString(),
      status: 'departed',
      mode: 'PENDING_LIVE'
    };
    state.status = 'departed';
    state.error = null;
    const result = await send('/journeys', { action: 'departure', ...state.journey }, 'departure');
    if (!result.live) state.journey.mode = 'DEMO_OR_OFFLINE';
    persist();
    return { ok: true, ...result, journey: state.journey };
  }

  async function recordLocation(position) {
    if (!state.journey || TERMINAL.has(state.status)) return { ok: false, reason: 'No active journey.' };
    const c = position && position.coords;
    if (!c || typeof c.latitude !== 'number' || typeof c.longitude !== 'number') {
      return { ok: false, reason: 'Valid GPS coordinates are required.' };
    }
    const location = {
      journey_id: state.journey.journey_id,
      vehicle_id: state.journey.vehicle_id,
      timestamp: new Date(position.timestamp || Date.now()).toISOString(),
      latitude: c.latitude,
      longitude: c.longitude,
      accuracy_m: typeof c.accuracy === 'number' ? c.accuracy : null,
      speed_kph: typeof c.speed === 'number' && c.speed >= 0 ? c.speed * 3.6 : null,
      heading_deg: typeof c.heading === 'number' && c.heading >= 0 ? c.heading : null,
      source: 'browser_geolocation'
    };
    state.lastLocation = location;
    state.status = state.status === 'departed' || state.status === 'paused' ? 'en_route' : state.status;
    const result = await send('/locations', location, 'location');
    persist();
    return { ok: true, ...result, location };
  }

  async function event(type, payload = {}) {
    if (!state.journey) return { ok: false, reason: 'No active journey.' };
    const map = {
      pause: 'paused', resume: 'en_route', arrival: 'arrived', delivery_confirmed: 'delivered',
      exception: 'exception'
    };
    if (map[type]) state.status = map[type];
    const body = {
      event_id: `J-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      journey_id: state.journey.journey_id,
      vehicle_id: state.journey.vehicle_id,
      driver_id: state.journey.driver_id,
      event_type: type,
      timestamp: new Date().toISOString(),
      ...payload
    };
    const result = await send('/events', body, type);
    persist();
    return { ok: true, ...result, event: body };
  }

  async function close(payload = {}) {
    if (state.status !== 'delivered' && state.status !== 'arrived') {
      return { ok: false, blocked: true, reason: 'Journey must arrive before closure.' };
    }
    const result = await event('closure', payload);
    if (result.ok) {
      state.status = 'closed';
      state.journey.closed_at = new Date().toISOString();
      persist();
    }
    return result;
  }

  function startGPS() {
    if (!navigator.geolocation) return { started: false, reason: 'Geolocation unavailable.' };
    if (!state.journey) return { started: false, reason: 'No active journey.' };
    const watchId = navigator.geolocation.watchPosition(recordLocation, (error) => {
      state.error = `GPS ${error.code}: ${error.message}`;
      emit();
    }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    return { started: true, watchId };
  }

  window.addEventListener('online', flushOutbox);
  window.SHELTON_FREIGHT_JOURNEY = {
    state,
    start,
    recordLocation,
    event,
    close,
    startGPS,
    flushOutbox,
    api: API
  };
  emit();
})();
