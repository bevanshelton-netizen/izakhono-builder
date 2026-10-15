/* IZAKHONO NAV — Tracker ↔ FORTRESS bridge v1
 * Connects local incident identity to the paired vehicle/tracker record.
 * No network dispatch, law-enforcement access, or vehicle-control commands.
 */
(() => {
  const tracker = () => window.IZAKHONOTracker;
  const fortress = () => window.IZAKHONOFortress;

  function beginRecoveryFromIncident(incident) {
    const t = tracker();
    if (!t || !incident?.id) return { ok: false, reason: "TRACKER_ENGINE_UNAVAILABLE" };
    let vehicle = t.load();
    if (!vehicle) vehicle = t.createVehicle("My Vehicle");
    const updated = t.beginRecovery(incident.id);
    return { ok: !!updated, vehicle: updated || vehicle, incidentId: incident.id, action: "LOCAL_RECOVERY_LINKED" };
  }

  function clearRecovery() {
    const t = tracker();
    if (!t) return { ok: false, reason: "TRACKER_ENGINE_UNAVAILABLE" };
    const updated = t.clearRecovery();
    return { ok: !!updated, vehicle: updated || null, action: "LOCAL_RECOVERY_CLEARED" };
  }

  window.IZAKHONOTrackerFortress = Object.freeze({
    version: "tracker-fortress-bridge-v1",
    beginRecoveryFromIncident,
    clearRecovery
  });
})();
