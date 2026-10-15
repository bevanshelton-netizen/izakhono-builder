/* IZAKHONO NAV — authenticated telemetry contract v1
 * Local-first telemetry ingestion boundary.
 * This module accepts normalized telemetry only; it does not create a network
 * connection, dispatch responders, expose police access, or issue vehicle commands.
 */
(() => {
  const KEY = "izakhono_nav_telemetry_v1";
  const ALLOWED = [
    "latitude", "longitude", "speed", "heading", "battery",
    "lastSeen", "tamper", "ignition", "signal", "impact"
  ];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); }
    catch (_) { return null; }
  }

  function normalise(input = {}) {
    const output = {};
    for (const key of ALLOWED) if (Object.prototype.hasOwnProperty.call(input, key)) output[key] = input[key];
    output.receivedAt = new Date().toISOString();
    return output;
  }

  function ingest(input, options = {}) {
    const telemetry = normalise(input);
    const record = {
      version: "telemetry-v1",
      source: options.source || "LOCAL_SIMULATOR",
      authenticated: options.authenticated === true,
      vehicleId: options.vehicleId || null,
      trackerId: options.trackerId || null,
      telemetry
    };
    localStorage.setItem(KEY, JSON.stringify(record));
    return { ok: true, status: "LOCAL_TELEMETRY_ACCEPTED", record };
  }

  function clear() {
    localStorage.removeItem(KEY);
    return { ok: true, status: "LOCAL_TELEMETRY_CLEARED" };
  }

  window.IZAKHONOTelemetry = Object.freeze({
    version: "telemetry-v1",
    load,
    normalise,
    ingest,
    clear,
    allowedFields: ALLOWED.slice()
  });
})();
