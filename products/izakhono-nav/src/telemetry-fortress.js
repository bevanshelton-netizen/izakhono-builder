/* IZAKHONO NAV — telemetry → FORTRESS safety intelligence v1
 * Conservative local decision layer. It detects combinations of signals,
 * never dispatches responders, never contacts police, and never controls a vehicle.
 */
(() => {
  const KEY = "izakhono_nav_fortress_intelligence_v1";
  const STATES = Object.freeze({ NORMAL: "NORMAL", WATCH: "WATCH", ALERT: "ALERT", RECOVERY: "RECOVERY" });

  function readTelemetry() {
    return window.IZAKHONOTelemetry?.load?.() || null;
  }

  function evaluate(record) {
    const t = record?.telemetry || {};
    const reasons = [];
    let score = 0;

    if (t.tamper === true) { score += 3; reasons.push("TRACKER_TAMPER"); }
    if (t.impact === true) { score += 3; reasons.push("IMPACT_SIGNAL"); }
    if (typeof t.signal === "string" && ["NONE", "LOST", "OFFLINE"].includes(t.signal.toUpperCase())) {
      score += 1; reasons.push("CONNECTIVITY_LOSS");
    }
    if (typeof t.battery === "number" && t.battery <= 10) { score += 1; reasons.push("LOW_TRACKER_BATTERY"); }

    const recoveryActive = !!(record?.recovery?.active);
    if (recoveryActive) { score += 4; reasons.push("RECOVERY_ACTIVE"); }

    let state = STATES.NORMAL;
    if (score >= 6 || recoveryActive) state = STATES.RECOVERY;
    else if (score >= 3) state = STATES.ALERT;
    else if (score >= 1) state = STATES.WATCH;

    return {
      version: "fortress-intelligence-v1",
      evaluatedAt: new Date().toISOString(),
      state,
      score,
      reasons,
      requiresHumanConfirmation: state === STATES.ALERT || state === STATES.RECOVERY,
      automatedVehicleAction: "NONE",
      automatedDispatch: "NONE"
    };
  }

  function assess(record = readTelemetry()) {
    const result = evaluate(record);
    localStorage.setItem(KEY, JSON.stringify(result));
    return result;
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); }
    catch (_) { return null; }
  }

  function clear() {
    localStorage.removeItem(KEY);
    return { ok: true, status: "FORTRESS_INTELLIGENCE_CLEARED" };
  }

  window.IZAKHONOFortressIntelligence = Object.freeze({
    version: "fortress-intelligence-v1",
    STATES,
    evaluate,
    assess,
    load,
    clear
  });
})();
