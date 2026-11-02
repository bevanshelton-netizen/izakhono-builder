(function () {
  'use strict';

  const API = '/api/nav/vehicle-integration';
  const state = {
    mode: 'UNAVAILABLE',
    connection: 'UNAVAILABLE',
    vehicle: null,
    events: [],
    outbox: [],
    audit: [],
    lastSync: null,
    error: null
  };

  function verified(source) {
    return !!source && source.verified === true && source.demo !== true;
  }

  function now() { return new Date().toISOString(); }

  function movementAllowsImmobilization(vehicle) {
    return vehicle && vehicle.movement_state === 'STATIONARY';
  }

  function evaluateConnection(vehicle) {
    if (!vehicle) return 'UNAVAILABLE';
    if (vehicle.connection_state === 'CONNECTED') return 'CONNECTED';
    if (vehicle.connection_state === 'DEGRADED') return 'DEGRADED';
    if (vehicle.connection_state === 'RECOVERED') return 'RECOVERED';
    if (vehicle.connection_state === 'COMMUNICATION_LOST') return 'COMMUNICATION_LOST';
    return 'UNAVAILABLE';
  }

  function ingest(event) {
    const record = Object.assign({
      event_id: 'veh-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      received_at: now()
    }, event || {});

    if (!verified(record)) {
      record.operational_effect = 'OBSERVE_ONLY';
      record.reason = 'Unverified or demo vehicle data cannot create operational claims.';
    } else if (record.type === 'communication_lost') {
      record.operational_effect = 'MONITOR';
      record.reason = 'Communication loss changes trust state; it does not prove the vehicle is safe or compromised.';
    } else if (record.type === 'security_event') {
      record.operational_effect = 'FORTRESS_REVIEW';
      record.reason = 'Verified security event requires FORTRESS and authorized workflow evaluation.';
    } else {
      record.operational_effect = 'ACCEPT_VERIFIED_STATE';
    }

    state.events.unshift(record);
    state.events = state.events.slice(0, 100);
    state.audit.unshift({ event_id: record.event_id, action: record.operational_effect, at: now() });
    return record;
  }

  function requestAction(action, vehicle) {
    const safeActions = ['RECORD_STATE', 'MONITOR', 'FORTRESS_REVIEW', 'REVALIDATE'];
    if (!safeActions.includes(action)) {
      throw new Error('Unsupported vehicle action. Authenticated vehicle integrations are required for deeper control.');
    }

    const record = {
      action_id: 'vact-' + Date.now(),
      action,
      vehicle_id: vehicle && vehicle.vehicle_id,
      requested_at: now(),
      human_authorization_required: action === 'FORTRESS_REVIEW' || action === 'REVALIDATE',
      movement_state: vehicle && vehicle.movement_state,
      audit: true
    };

    state.outbox.push(record);
    state.audit.unshift(record);
    return record;
  }

  function requestSecureState(vehicle) {
    if (!vehicle || !verified(vehicle.source)) throw new Error('Verified vehicle source required.');
    if (!movementAllowsImmobilization(vehicle)) {
      throw new Error('Vehicle is moving or movement is not verified. Sudden immobilization is prohibited.');
    }
    return requestAction('FORTRESS_REVIEW', vehicle);
  }

  async function sync() {
    state.error = null;
    try {
      const response = await fetch(API + '/state', { headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error('Vehicle integration feed unavailable');
      const payload = await response.json();
      state.vehicle = payload.vehicle || payload;
      state.connection = evaluateConnection(state.vehicle);
      state.mode = 'LIVE';
      state.lastSync = now();
      return state.vehicle;
    } catch (error) {
      state.mode = 'UNAVAILABLE';
      state.connection = 'UNAVAILABLE';
      state.error = error.message;
      return null;
    }
  }

  async function flush() {
    const pending = state.outbox.splice(0);
    for (const item of pending) {
      try {
        const response = await fetch(API + '/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        if (!response.ok) throw new Error('Event rejected');
      } catch (error) {
        state.outbox.push(item);
        state.error = error.message;
      }
    }
    return state.outbox.length === 0;
  }

  function loadDemo() {
    state.mode = 'DEMO';
    state.vehicle = {
      vehicle_id: 'DEMO-VEHICLE-001',
      connection_state: 'CONNECTED',
      movement_state: 'STATIONARY',
      source: { verified: false, demo: true }
    };
    state.connection = 'CONNECTED';
    ingest({
      type: 'vehicle_state',
      vehicle_id: state.vehicle.vehicle_id,
      verified: false,
      demo: true
    });
    return state.vehicle;
  }

  function clear() {
    state.events = [];
    state.outbox = [];
    state.audit = [];
    state.error = null;
  }

  window.SHELTON_FREIGHT_VEHICLE_INTEGRATION = {
    state,
    sync,
    flush,
    ingest,
    requestAction,
    requestSecureState,
    loadDemo,
    clear,
    evaluateConnection
  };
})();