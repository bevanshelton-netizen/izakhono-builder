/* IZAKHONO NAV FORTRESS — Response/Recovery adapter contract
 * Safe integration boundary. This module deliberately performs NO network calls.
 * Real response, law-enforcement, tracker and vehicle-control adapters must be
 * explicitly authorised, authenticated, audited and implemented behind this contract.
 */
(() => {
  const VERSION = "fortress-adapter-v1";
  const ALLOWED = new Set(["STAGE_INCIDENT", "CANCEL_INCIDENT", "CONFIRM_SAFE"]);

  function normaliseIncident(input = {}) {
    return {
      version: VERSION,
      id: String(input.id || ""),
      mode: input.mode === "HIJACK" ? "HIJACK" : "SOS",
      createdAt: input.createdAt || new Date().toISOString(),
      location: input.location || null,
      vehicleId: input.vehicleId || null,
      trackerId: input.trackerId || null,
      status: input.status || "LOCAL_STAGED"
    };
  }

  function createAdapter(overrides = {}) {
    const safe = {};
    for (const action of ALLOWED) {
      safe[action] = typeof overrides[action] === "function"
        ? overrides[action]
        : async (payload) => ({ ok: false, action, status: "NOT_CONNECTED", payload });
    }
    return Object.freeze({ version: VERSION, ...safe });
  }

  window.IZAKHONOFortress = Object.freeze({
    version: VERSION,
    allowedActions: [...ALLOWED],
    normaliseIncident,
    createAdapter
  });
})();
