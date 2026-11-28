import path from "node:path";
import { fileURLToPath } from "node:url";
import { createNodeEngine } from "./engine.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "../site");
const engine = createNodeEngine({ siteRoot, host: "127.0.0.1", port: 4321 });

const status = await engine.start();
console.log("IZAKHONO NODE ENGINE local prototype");
console.log(`Serving this device's site at ${status.url}`);
console.log("Exposure: loopback only. No LAN or public listener is enabled.");
console.log("Press Ctrl+C to stop hosting.");

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await engine.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
