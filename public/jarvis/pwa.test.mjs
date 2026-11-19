import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("./manifest.webmanifest", import.meta.url), "utf8"));
const worker = await readFile(new URL("./sw.js", import.meta.url), "utf8");
const html = await readFile(new URL("./index.html", import.meta.url), "utf8");

assert.equal(manifest.start_url, "/jarvis/");
assert.equal(manifest.scope, "/jarvis/");
assert.equal(manifest.display, "standalone");
assert.ok(manifest.icons.some((icon) => icon.src === "/jarvis/icon.svg"));
assert.match(html, /rel="manifest" href="\/jarvis\/manifest\.webmanifest"/);
assert.match(html, /src="\/jarvis\/pwa\.js" defer/);
assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
assert.match(worker, /request\.headers\.has\("x-admin-secret"\)/);
assert.match(worker, /cacheableShellResponse/);
assert.match(worker, /jarvis-shell-v1/);

console.log("J.A.R.V.I.S. offline app-shell policy tests passed");
