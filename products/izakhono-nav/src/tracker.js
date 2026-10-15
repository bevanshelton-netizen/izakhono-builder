/* IZAKHONO NAV — Vehicle Tracker / Identity Engine v1
 * Local-first device layer. No covert tracking, no remote commands, no dispatch.
 * A real tracker backend must authenticate the vehicle and explicitly connect here.
 */
(() => {
  const KEY = "izakhono_nav_tracker_v1";
  const STATES = ["UNPAIRED", "PAIRED", "MOVING", "TAMPER_ALERT", "RECOVERY"];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null") || null; } catch (_) { return null; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} };
  const makeId = p => `${p}-${crypto?.randomUUID?.() || Date.now().toString(36)}`.toUpperCase();

  function createVehicle(label = "My Vehicle") {
    const vehicle = {
      vehicleId: makeId("NAV-VHC"),
      trackerId: makeId("NAV-TRK"),
      label: String(label).slice(0, 60) || "My Vehicle",
      state: "PAIRED",
      pairedAt: new Date().toISOString(),
      tracker: { connected: false, battery: null, lastSeen: null, tamper: false },
      recovery: { active: false, caseId: null },
      telemetry: { speed: null, heading: null, latitude: null, longitude: null }
    };
    save(vehicle); return vehicle;
  }

  function setState(next) {
    const current = load(); if (!current || !STATES.includes(next)) return null;
    current.state = next; save(current); return current;
  }

  function updateTracker(patch = {}) {
    const current = load(); if (!current) return null;
    current.tracker = { ...current.tracker, ...patch };
    if (current.tracker.tamper) current.state = "TAMPER_ALERT";
    save(current); return current;
  }

  function beginRecovery(caseId) {
    const current = load(); if (!current || !caseId) return null;
    current.recovery = { active: true, caseId: String(caseId) };
    current.state = "RECOVERY"; save(current); return current;
  }

  function clearRecovery() {
    const current = load(); if (!current) return null;
    current.recovery = { active: false, caseId: null };
    current.state = current.tracker?.tamper ? "TAMPER_ALERT" : "PAIRED";
    save(current); return current;
  }

  window.IZAKHONOTracker = Object.freeze({
    version: "tracker-v1",
    states: [...STATES],
    load,
    createVehicle,
    setState,
    updateTracker,
    beginRecovery,
    clearRecovery
  });
})();
