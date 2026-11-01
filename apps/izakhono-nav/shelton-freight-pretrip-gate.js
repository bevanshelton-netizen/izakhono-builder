(function () {
  'use strict';

  const DEFAULTS = {
    mode: 'DEMO',
    hazardFeedConfigured: false,
    securityReady: false,
    routeAvailable: true,
    connectivity: 'UNKNOWN',
    vehicleHealth: 'NOT_CONNECTED'
  };

  function result(state) {
    const s = Object.assign({}, DEFAULTS, state || {});
    const reasons = [];
    const warnings = [];

    if (!s.driver) reasons.push('Driver identity missing');
    else if (s.driver.authorized !== true) reasons.push('Driver not authorized');

    if (!s.vehicle) reasons.push('Vehicle identity missing');
    else if (s.vehicle.authorized !== true) reasons.push('Vehicle not authorized');

    if (s.driver && s.vehicle && s.driver.authorized === true && s.vehicle.authorized === true) {
      if (Array.isArray(s.vehicle.allowedLicenceClasses) && s.driver.licenceClass && !s.vehicle.allowedLicenceClasses.includes(s.driver.licenceClass)) {
        reasons.push('Driver licence class incompatible with vehicle');
      }
    }

    if (!s.journey) reasons.push('Journey assignment missing');
    if (!s.routeAvailable) reasons.push('Route unavailable');
    if (!s.securityReady) reasons.push('Security readiness not confirmed');

    if (!s.hazardFeedConfigured) {
      warnings.push('Verified hazard feed is not connected; safety assessment remains provisional');
    }
    if (s.connectivity === 'OFFLINE' || s.connectivity === 'DEGRADED') {
      warnings.push('Connectivity is degraded; offline resilience required');
    }
    if (s.vehicleHealth === 'NOT_CONNECTED') {
      warnings.push('Live vehicle-health telemetry is not connected');
    }

    let status = reasons.length ? 'BLOCKED' : (warnings.length ? 'PROVISIONAL' : 'READY');
    if (s.mode === 'DEMO') status = reasons.length ? 'BLOCKED' : 'PROVISIONAL';

    return {
      status,
      departureAllowed: status === 'READY' || status === 'PROVISIONAL',
      mode: s.mode,
      reasons,
      warnings,
      checkedAt: new Date().toISOString()
    };
  }

  function emit(payload) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('shelton-freight-pretrip', { detail: payload }));
    }
  }

  function evaluate(state) {
    const assessment = result(state);
    emit(assessment);
    return assessment;
  }

  if (typeof window !== 'undefined') {
    window.SHELTON_FREIGHT_PRETRIP = {
      evaluate,
      version: '0.1',
      contract: 'apps/izakhono-nav/shelton-freight-pretrip-gate.json'
    };
  }
})();
