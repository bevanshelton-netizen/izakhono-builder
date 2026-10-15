/* IZAKHONO NAV FORTRESS — Safe Surrender / Recovery UI layer
 * Safety-first prototype: no remote engine shutdown, no dispatch, no police access.
 * All incident state is local until a verified backend/response adapter is connected.
 */
(() => {
  const KEY = "izakhono_fortress_v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null") || { mode: "READY", incidents: [] }; } catch (_) { return { mode: "READY", incidents: [] }; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} };
  let state = load();

  const style = document.createElement("style");
  style.textContent = `
    .fortress-card{margin:12px 0;padding:16px;border:1px solid rgba(244,196,48,.28);border-radius:18px;background:linear-gradient(135deg,rgba(10,18,31,.96),rgba(25,19,8,.94));box-shadow:0 12px 35px rgba(0,0,0,.22)}
    .fortress-card b{display:block;color:#f4c430;font-size:15px}.fortress-card small{display:block;color:#b9c3d0;margin:5px 0 12px;line-height:1.4}
    .fortress-actions{display:flex;gap:8px;flex-wrap:wrap}.fortress-btn{border:0;border-radius:12px;padding:11px 14px;font-weight:800;cursor:pointer}.fortress-btn.primary{background:#b31217;color:#fff}.fortress-btn.secondary{background:#263447;color:#fff}
    .fortress-overlay{position:fixed;inset:0;background:rgba(2,5,10,.88);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}.fortress-modal{max-width:440px;width:100%;background:#0a1220;color:#fff;border:1px solid rgba(244,196,48,.4);border-radius:24px;padding:24px;box-shadow:0 30px 90px #000}.fortress-modal h2{margin:0 0 8px;color:#f4c430}.fortress-modal p{color:#c5cfdb;line-height:1.5}.fortress-pill{display:inline-block;padding:7px 10px;border-radius:999px;background:#321217;color:#ffb4b8;font-weight:800;font-size:12px;margin-bottom:12px}
  `;
  document.head.appendChild(style);

  function notify(message) {
    const el = document.createElement("div");
    el.textContent = message;
    el.style.cssText = "position:fixed;left:16px;right:16px;bottom:86px;z-index:10000;padding:13px 16px;border-radius:14px;background:#111d2e;color:#fff;border:1px solid rgba(244,196,48,.35);font-weight:700;text-align:center";
    document.body.appendChild(el); setTimeout(() => el.remove(), 3600);
  }

  function incident(mode) {
    const item = { id: "FOR-" + Date.now(), mode, createdAt: new Date().toISOString(), status: "LOCAL_STAGED", dispatch: false, vehicleCommand: "NONE" };
    state = { ...state, mode: "FORTRESS_ACTIVE", incidents: [item, ...(state.incidents || [])].slice(0, 20) }; save(state);
    openActive(item);
  }

  function openActive(item) {
    const overlay = document.createElement("div"); overlay.className = "fortress-overlay";
    overlay.innerHTML = `<div class="fortress-modal"><span class="fortress-pill">FORTRESS RECOVERY MODE</span><h2>Protect yourself first.</h2><p><b>Do not fight for the vehicle.</b> If you are being hijacked, prioritise getting yourself and passengers to safety. NAV can preserve the vehicle recovery record without asking you to confront the attacker.</p><div class="fortress-card"><b>${item.mode === "HIJACK" ? "HIJACK INCIDENT STAGED" : "SOS INCIDENT STAGED"}</b><small>Case ${item.id}<br>Local recovery identity recorded. No police, private security or emergency service has been contacted by this prototype.</small></div><div class="fortress-actions"><button id="fortressCancel" class="fortress-btn secondary">CANCEL / FALSE ALARM</button><button id="fortressClose" class="fortress-btn primary">I AM SAFE</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#fortressCancel").onclick = () => { state.mode = "READY"; save(state); overlay.remove(); notify("FORTRESS incident cancelled locally."); };
    overlay.querySelector("#fortressClose").onclick = () => { state.mode = "READY"; save(state); overlay.remove(); notify("FORTRESS record retained for audit."); };
  }

  function mount() {
    if (document.querySelector(".fortress-card")) return;
    const anchor = document.querySelector(".guardian") || document.querySelector(".panel") || document.querySelector("main");
    if (!anchor) return setTimeout(mount, 500);
    const card = document.createElement("div"); card.className = "fortress-card";
    card.innerHTML = `<b>🛡️ FORTRESS — Safe Surrender</b><small>Give up the car. Keep your life. Silent recovery mode is designed to preserve the vehicle recovery identity while you prioritise personal safety.</small><div class="fortress-actions"><button id="fortressSOS" class="fortress-btn primary">SILENT SOS</button><button id="fortressHijack" class="fortress-btn secondary">HIJACK MODE</button></div>`;
    anchor.parentNode.insertBefore(card, anchor.nextSibling);
    card.querySelector("#fortressSOS").onclick = () => incident("SOS");
    card.querySelector("#fortressHijack").onclick = () => incident("HIJACK");
    if (state.mode === "FORTRESS_ACTIVE") notify("FORTRESS recovery state is active on this device.");
  }

  // The existing NAV app renders dynamically, so mount after each render without modifying its core engine.
  const observer = new MutationObserver(() => mount());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
