/* IZAKHONO NAV — FORTRESS ↔ Tracker bridge v1
 * Local integration only. Creates a vehicle identity when needed and links
 * staged FORTRESS cases to that vehicle's recovery state.
 */
(() => {
  const bridge = {
    version: "fortress-tracker-bridge-v1",
    ensureVehicle(label = "My Vehicle") {
      if (!window.IZAKHONOTracker) return null;
      return window.IZAKHONOTracker.load() || window.IZAKHONOTracker.createVehicle(label);
    },
    startRecovery(caseId, label) {
      const vehicle = this.ensureVehicle(label);
      if (!vehicle || !window.IZAKHONOTracker) return { ok: false, status: "TRACKER_ENGINE_UNAVAILABLE" };
      const updated = window.IZAKHONOTracker.beginRecovery(caseId);
      return updated ? { ok: true, status: "LOCAL_RECOVERY_LINKED", vehicle: updated } : { ok: false, status: "RECOVERY_LINK_FAILED" };
    },
    stopRecovery() {
      const updated = window.IZAKHONOTracker?.clearRecovery?.();
      return updated ? { ok: true, status: "LOCAL_RECOVERY_CLEARED", vehicle: updated } : { ok: false, status: "NO_VEHICLE" };
    }
  };
  window.IZAKHONOFortressTracker = Object.freeze(bridge);
})();
