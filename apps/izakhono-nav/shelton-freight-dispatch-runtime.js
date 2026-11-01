/* SHELTON FREIGHT Dispatch Runtime
 * Connects Dispatch -> identity -> assignment -> pre-trip gate.
 * API-first; explicit local/demo fallback. Never represents demo state as live.
 */
(function () {
  'use strict';

  const API = '/api/freight';
  const state = {
    mode: 'DEMO',
    dispatch: null,
    assignment: null,
    gate: null,
    lastAction: null,
    error: null
  };

  function emit() {
    window.dispatchEvent(new CustomEvent('shelton-freight-dispatch-state', { detail: state }));
  }

  function getGate() {
    return window.SHELTON_FREIGHT_PRETRIP_GATE || null;
  }

  async function post(path, payload) {
    const response = await fetch(API + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('API ' + response.status);
    return response.json();
  }

  async function dispatch(input) {
    state.error = null;
    state.lastAction = 'dispatch-check';

    const gate = getGate();
    if (!gate || typeof gate.evaluate !== 'function') {
      state.gate = { decision: 'HOLD', reason: 'Pre-Trip Safety Gate unavailable' };
      state.error = 'Safety gate unavailable';
      emit();
      return state;
    }

    const result = gate.evaluate(input);
    state.gate = result;

    if (result.decision === 'BLOCKED' || result.decision === 'HOLD') {
      emit();
      return state;
    }

    try {
      state.assignment = await post('/journeys', {
        action: 'dispatch',
        vehicle_id: input.vehicleId,
        driver_id: input.driverId,
        journey_id: input.journeyId,
        gate_decision: result.decision,
        source: 'shelton-freight-dispatch'
      });
      state.mode = 'LIVE';
    } catch (error) {
      state.mode = 'DEMO';
      state.error = 'Fleet API unavailable; dispatch retained locally as DEMO only.';
      state.assignment = {
        status: 'DEMO_PENDING',
        vehicle_id: input.vehicleId,
        driver_id: input.driverId,
        journey_id: input.journeyId,
        gate_decision: result.decision,
        assigned_at: new Date().toISOString()
      };
    }

    state.dispatch = input;
    emit();
    return state;
  }

  function clear() {
    state.dispatch = null;
    state.assignment = null;
    state.gate = null;
    state.lastAction = 'clear';
    state.error = null;
    emit();
  }

  window.SHELTON_FREIGHT_DISPATCH = { state, dispatch, clear, api: API };
  emit();
})();
