(() => {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js").catch(() => {}));
  let promptEvent;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    promptEvent = event;
    const button = document.querySelector("#installApp");
    if (button) button.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    const button = document.querySelector("#installApp");
    if (button) { button.hidden = true; button.textContent = "Installed"; }
  });
  document.addEventListener("click", async event => {
    if (!event.target.closest("#installApp")) return;
    if (!promptEvent) {
      alert("On Android: open the browser menu and choose Add to Home screen or Install app. On Windows: use the install icon in the browser address bar.");
      return;
    }
    promptEvent.prompt();
    await promptEvent.userChoice;
    promptEvent = null;
  });
})();