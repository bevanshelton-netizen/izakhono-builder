import path from "node:path";
import { fileURLToPath } from "node:url";
import { createNodeEngine } from "./engine.mjs";
import { createControlPlane } from "./control-plane.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "../site");
const engine = createNodeEngine({ siteRoot, host: "127.0.0.1", port: 4321 });
const control = createControlPlane({ engine, host: "127.0.0.1", port: 4322 });
const site = await engine.start();
const dashboard = await control.start();
console.log("IZAKHONO NODE ENGINE local prototype");
console.log("Website: " + site.url);
console.log("Owner control panel: " + dashboard.url);
console.log("Both listeners are loopback-only. No LAN or public listener is enabled.");
console.log("Stop the engine from the control panel or press Ctrl+C.");
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await engine.stop();
  await control.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
